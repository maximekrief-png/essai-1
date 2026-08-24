# -*- coding: utf-8 -*-
"""
Générateur de vidéo d'entraînement callisthénie.

Produit un MP4 vertical (720x1280) : pour chaque exercice, 30 s d'effort avec
compte à rebours + pictogramme animé, suivies de 30 s de repos (avec aperçu de
l'exercice suivant). Bips sonores aux transitions et sur les 3 dernières
secondes de chaque phase.

Usage : python3 generate_workout_video.py [sortie.mp4]
La liste des exercices se modifie dans EXOS ci-dessous.
"""

import math
import struct
import subprocess
import sys
import wave

from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------

W, H = 720, 1280
FPS = 10
WORK_S = 30
REST_S = 30
INTRO_S = 5
OUTRO_S = 5
SR = 44100  # audio sample rate

EXOS = [
    ("POMPES", "pushup"),
    ("PLANCHE", "plank"),
    ("MONTÉES DE GENOUX", "highknees"),
    ("DIPS", "dips"),
    ("RELEVÉS DE JAMBES", "legraise"),
    ("TALONS-FESSES", "buttkick"),
    ("POMPES SUR LES GENOUX", "kneepushup"),
    ("ROTATION DE BUSTE ASSIS", "twist"),
]

FONT_DIR = "/mnt/skills/examples/canvas-design/canvas-fonts"
F_TITLE = f"{FONT_DIR}/BigShoulders-Bold.ttf"
F_LABEL = f"{FONT_DIR}/Outfit-Bold.ttf"
F_SMALL = f"{FONT_DIR}/Outfit-Regular.ttf"

BG_TOP = (15, 21, 34)
BG_BOT = (26, 34, 51)
TXT = (244, 247, 251)
TXT_DIM = (143, 160, 184)
C_WORK = (224, 82, 82)
C_REST = (62, 198, 168)
C_NEUTRAL = (242, 184, 75)
CARD = (23, 31, 47)

# ----------------------------------------------------------------------------
# Petits utilitaires dessin
# ----------------------------------------------------------------------------

_font_cache = {}


def font(path, size):
    key = (path, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(path, size)
    return _font_cache[key]


def text_center(draw, xy, s, f, fill):
    draw.text(xy, s, font=f, fill=fill, anchor="mm")


def lerp(a, b, s):
    return a + (b - a) * s


def P(a, b, s):
    return (lerp(a[0], b[0], s), lerp(a[1], b[1], s))


def make_background():
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        r = int(lerp(BG_TOP[0], BG_BOT[0], t))
        g = int(lerp(BG_TOP[1], BG_BOT[1], t))
        b = int(lerp(BG_TOP[2], BG_BOT[2], t))
        for x in range(W):
            px[x, y] = (r, g, b)
    return img


# ----------------------------------------------------------------------------
# Pictogrammes animés (bonhommes bâtons, vue de profil)
# Chaque pose retourne (lines, head_center, extra) en coordonnées unité
# (x vers la droite, y vers le bas, boîte environ [-1, 1]).
# ----------------------------------------------------------------------------

GY = 0.55  # niveau du sol


def _dir(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1.0
    return dx / n, dy / n


def pose_pushup(s, knees=False):
    lines = []
    h = 0.50 - 0.26 * s
    if knees:
        contact = (0.35, GY - 0.02)
        foot = (0.62, GY - 0.22)
        lines.append([contact, foot])  # tibia relevé
    else:
        contact = (0.75, GY - 0.02)
    sh = (-0.45, GY - h)
    lines.append([contact, sh])  # corps
    d = _dir(contact, sh)
    head = (sh[0] + d[0] * 0.17, sh[1] + d[1] * 0.17)
    hand = (-0.52, GY)
    mx, my = (sh[0] + hand[0]) / 2, (sh[1] + hand[1]) / 2
    elbow = (mx + 0.06 + 0.20 * s, my)
    lines.append([sh, elbow, hand])  # bras
    lines.append([(-0.9, GY), (0.9, GY)])  # sol
    return lines, head


def pose_plank(s):
    bob = 0.02 * s
    lines = []
    elbow = (-0.45, GY)
    hand = (-0.12, GY)
    sh = (-0.45, GY - 0.34 - bob)
    foot = (0.75, GY - 0.02)
    lines.append([foot, sh])
    lines.append([sh, elbow, hand])
    d = _dir(foot, sh)
    head = (sh[0] + d[0] * 0.17, sh[1] + d[1] * 0.17 - 0.02)
    lines.append([(-0.9, GY), (0.9, GY)])
    return lines, head


def pose_dips(s):
    lines = []
    # banc
    lines.append([(-0.75, 0.18), (-0.15, 0.18)])
    lines.append([(-0.68, 0.18), (-0.68, GY)])
    lines.append([(-0.22, 0.18), (-0.22, GY)])
    sh = (-0.05, -0.25 + 0.22 * s)
    hip = (-0.12, sh[1] + 0.42)
    knee = (0.28, hip[1] + 0.10)
    foot = (0.48, GY)
    head = (sh[0] + 0.02, sh[1] - 0.15)
    hand = (-0.18, 0.18)
    elbow = (-0.30, sh[1] + 0.16 + 0.05 * s)
    lines.append([sh, hip, knee, foot])
    lines.append([sh, elbow, hand])
    lines.append([(-0.9, GY), (0.9, GY)])
    return lines, head


def _standing_base():
    hip = (0.0, 0.05)
    sh = (0.02, -0.32)
    head = (0.04, -0.47)
    return hip, sh, head


def pose_highknees(p):
    hip, sh, head = _standing_base()
    lines = [[hip, sh]]

    def leg(r):
        knee = (hip[0] + 0.06 + 0.22 * r, hip[1] + 0.30 - 0.26 * r)
        foot = (knee[0] - 0.04 + 0.06 * r, knee[1] + 0.26)
        return [hip, knee, foot]

    rA = max(0.0, math.sin(2 * math.pi * p))
    rB = max(0.0, math.sin(2 * math.pi * p + math.pi))
    lines.append(leg(rA))
    lines.append(leg(rB))
    sw = 0.06 * math.sin(2 * math.pi * p)
    lines.append([sh, (sh[0] + 0.16 + sw, sh[1] + 0.16), (sh[0] + 0.30 + sw, sh[1] + 0.02)])
    lines.append([(-0.9, GY), (0.9, GY)])
    # ancre les pieds au sol : décale tout vers le sol
    dy = GY - 0.61
    lines = [[(x, y + dy) for (x, y) in ln] if ln[0][1] < GY - 0.01 else ln for ln in lines]
    head = (head[0], head[1] + dy)
    return lines, head


def pose_buttkick(p):
    hip, sh, head = _standing_base()
    lines = [[hip, sh]]
    knee = (hip[0] + 0.02, hip[1] + 0.30)

    def leg(r):
        foot = P((knee[0] - 0.02, knee[1] + 0.26), (hip[0] - 0.20, hip[1] + 0.10), r)
        return [hip, knee, foot]

    rA = max(0.0, math.sin(2 * math.pi * p))
    rB = max(0.0, math.sin(2 * math.pi * p + math.pi))
    lines.append(leg(rA))
    lines.append(leg(rB))
    lines.append([sh, (sh[0] + 0.16, sh[1] + 0.16), (sh[0] + 0.30, sh[1] + 0.02)])
    lines.append([(-0.9, GY), (0.9, GY)])
    dy = GY - 0.61
    lines = [[(x, y + dy) for (x, y) in ln] if ln[0][1] < GY - 0.01 else ln for ln in lines]
    head = (head[0], head[1] + dy)
    return lines, head


def pose_legraise(s):
    lines = []
    sh = (-0.60, GY - 0.05)
    hip = (0.05, GY - 0.05)
    head = (-0.74, GY - 0.09)
    lines.append([sh, hip])
    lines.append([sh, (-0.25, GY - 0.02)])  # bras au sol
    a = 0.12 + 1.25 * s
    foot = (hip[0] + 0.58 * math.cos(a), hip[1] - 0.58 * math.sin(a))
    lines.append([hip, foot])
    lines.append([(-0.9, GY), (0.9, GY)])
    return lines, head


def pose_twist(p):
    lines = []
    hip = (0.0, 0.50)
    sh = (-0.26, 0.10)
    head = (-0.32, -0.06)
    knee = (0.30, 0.28)
    foot = (0.55, 0.42)
    lines.append([hip, sh])
    lines.append([hip, knee, foot])
    a = math.radians(lerp(-12, 38, 0.5 + 0.5 * math.sin(2 * math.pi * p)))
    hand = (sh[0] + 0.52 * math.cos(a), sh[1] + 0.52 * math.sin(a))
    lines.append([sh, hand])
    lines.append([(-0.9, GY), (0.9, GY)])
    return lines, head, hand


POSES = {
    "pushup": lambda t: pose_pushup(_osc(t)),
    "kneepushup": lambda t: pose_pushup(_osc(t), knees=True),
    "plank": lambda t: pose_plank(_osc(t, period=2.5)),
    "dips": lambda t: pose_dips(_osc(t)),
    "highknees": lambda t: pose_highknees((t / 1.0) % 1.0),
    "buttkick": lambda t: pose_buttkick((t / 1.0) % 1.0),
    "legraise": lambda t: pose_legraise(_osc(t)),
    "twist": lambda t: pose_twist((t / 1.6) % 1.0),
}


def _osc(t, period=1.6):
    return 0.5 - 0.5 * math.cos(2 * math.pi * t / period)


def draw_figure(kind, t, size, accent):
    """Rend le pictogramme sur une tuile 2x puis la réduit (anti-aliasing)."""
    T = size * 2
    tile = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    res = POSES[kind](t)
    lines, head = res[0], res[1]
    scale = T * 0.40
    cx = cy = T / 2

    def M(pt):
        return (cx + pt[0] * scale, cy + pt[1] * scale)

    lw = max(6, T // 34)
    for i, ln in enumerate(lines):
        pts = [M(p) for p in ln]
        is_ground = abs(ln[0][1] - GY) < 1e-6 and abs(ln[-1][1] - GY) < 1e-6 and len(ln) == 2 and ln[0][0] < -0.8
        color = (TXT_DIM + (110,)) if is_ground else (TXT + (255,))
        width = lw // 2 if is_ground else lw
        d.line(pts, fill=color, width=width, joint="curve")
        if not is_ground:
            for p in pts:
                r = width / 2
                d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=color)
    hc = M(head)
    hr = T * 0.045
    d.ellipse([hc[0] - hr, hc[1] - hr, hc[0] + hr, hc[1] + hr], fill=TXT + (255,))
    if len(res) > 2:  # médecine-ball pour la rotation de buste
        b = M(res[2])
        br = T * 0.035
        d.ellipse([b[0] - br, b[1] - br, b[0] + br, b[1] + br], fill=accent + (255,))
    return tile.resize((size, size), Image.LANCZOS)


def draw_ring(remaining_frac, size, accent):
    T = size * 2
    tile = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    m = T * 0.05
    wd = T * 0.045
    box = [m, m, T - m, T - m]
    d.arc(box, 0, 360, fill=(55, 66, 88, 255), width=int(wd))
    if remaining_frac > 0:
        end = -90 + 360 * remaining_frac
        d.arc(box, -90, end, fill=accent + (255,), width=int(wd))
    return tile.resize((size, size), Image.LANCZOS)


# ----------------------------------------------------------------------------
# Mise en page des écrans
# ----------------------------------------------------------------------------

def wrap_title(draw, name, f, max_w):
    if draw.textlength(name, font=f) <= max_w or " " not in name:
        return [name]
    words = name.split(" ")
    best, best_diff = 1, 1e9
    for i in range(1, len(words)):
        l1 = " ".join(words[:i])
        l2 = " ".join(words[i:])
        wmax = max(draw.textlength(l1, font=f), draw.textlength(l2, font=f))
        if wmax < best_diff:
            best_diff, best = wmax, i
    return [" ".join(words[:best]), " ".join(words[best:])]


def render_frame(bg, seg, t_in, total_elapsed, total_dur):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    kind = seg["kind"]
    dur = seg["dur"]
    remaining = max(0.0, dur - t_in)
    rem_int = int(math.ceil(remaining - 1e-9))

    accent = {"work": C_WORK, "rest": C_REST}.get(kind, C_NEUTRAL)

    f_top = font(F_LABEL, 30)
    f_name = font(F_TITLE, 96)
    f_timer = font(F_TITLE, 180)
    f_phase = font(F_LABEL, 44)
    f_sub = font(F_SMALL, 30)

    if kind in ("work", "rest"):
        idx, n = seg["idx"], len(EXOS)
        if kind == "work":
            top = f"EXERCICE {idx + 1} / {n}"
            name = EXOS[idx][0]
            fig_kind = EXOS[idx][1]
            phase_label = "EFFORT"
            fig_speed = 1.0
        else:
            top = f"SUIVANT — EXERCICE {idx + 1} / {n}"
            name = EXOS[idx][0]
            fig_kind = EXOS[idx][1]
            phase_label = "REPOS"
            fig_speed = 0.45

        text_center(d, (W / 2, 66), top, f_top, TXT_DIM)
        lines = wrap_title(d, name, f_name, W - 80)
        if len(lines) == 1:
            text_center(d, (W / 2, 165), lines[0], f_name, TXT)
        else:
            f_name2 = font(F_TITLE, 72)
            text_center(d, (W / 2, 138), lines[0], f_name2, TXT)
            text_center(d, (W / 2, 212), lines[1], f_name2, TXT)

        # carte pictogramme
        card_s = 430
        cx, cy = W // 2, 505
        d.rounded_rectangle(
            [cx - card_s // 2, cy - card_s // 2, cx + card_s // 2, cy + card_s // 2],
            radius=36, fill=CARD, outline=accent, width=3,
        )
        fig = draw_figure(fig_kind, t_in * fig_speed, card_s - 40, accent)
        img.paste(fig, (cx - fig.width // 2, cy - fig.height // 2), fig)
        d = ImageDraw.Draw(img)

        text_center(d, (W / 2, 790), phase_label, f_phase, accent)

        ring_s = 380
        rcx, rcy = W // 2, 1010
        ring = draw_ring(remaining / dur, ring_s, accent)
        img.paste(ring, (rcx - ring_s // 2, rcy - ring_s // 2), ring)
        d = ImageDraw.Draw(img)
        text_center(d, (rcx, rcy - 12), str(rem_int), f_timer, TXT)
        text_center(d, (rcx, rcy + 92), "SECONDES", f_sub, TXT_DIM)

    elif kind == "intro":
        text_center(d, (W / 2, 300), "CHALLENGE", font(F_TITLE, 110), TXT)
        text_center(d, (W / 2, 410), "CALLISTHÉNIE", font(F_TITLE, 110), C_NEUTRAL)
        text_center(d, (W / 2, 520), f"{len(EXOS)} exercices", f_phase, TXT)
        text_center(d, (W / 2, 580), "30 s d'effort — 30 s de repos", f_sub, TXT_DIM)
        ring_s = 380
        rcx, rcy = W // 2, 900
        ring = draw_ring(remaining / dur, ring_s, C_NEUTRAL)
        img.paste(ring, (rcx - ring_s // 2, rcy - ring_s // 2), ring)
        d = ImageDraw.Draw(img)
        text_center(d, (rcx, rcy - 6), str(rem_int), f_timer, TXT)
        text_center(d, (W / 2, 1150), "C'EST PARTI !", f_phase, TXT_DIM)

    else:  # outro
        text_center(d, (W / 2, 420), "SÉANCE", font(F_TITLE, 120), TXT)
        text_center(d, (W / 2, 540), "TERMINÉE !", font(F_TITLE, 120), C_REST)
        mins = int(total_dur // 60)
        secs = int(total_dur % 60)
        text_center(d, (W / 2, 700), f"{len(EXOS)} exercices — {mins} min {secs:02d}", f_phase, TXT)
        text_center(d, (W / 2, 780), "Bien joué, à demain !", f_sub, TXT_DIM)

    # barre de progression globale
    bar_w, bar_h, by = 560, 10, 1232
    x0 = (W - bar_w) // 2
    d.rounded_rectangle([x0, by, x0 + bar_w, by + bar_h], radius=5, fill=(45, 55, 75))
    fw = int(bar_w * min(1.0, total_elapsed / total_dur))
    if fw > 8:
        d.rounded_rectangle([x0, by, x0 + fw, by + bar_h], radius=5, fill=accent)
    return img


# ----------------------------------------------------------------------------
# Audio
# ----------------------------------------------------------------------------

def synth_audio(segments, total_dur, path):
    n = int(total_dur * SR) + SR
    buf = [0.0] * n

    def beep(t0, freq, dur, vol=0.35):
        i0 = int(t0 * SR)
        m = int(dur * SR)
        for i in range(m):
            if i0 + i >= n:
                break
            env = min(1.0, i / (0.01 * SR)) * min(1.0, (m - i) / (0.05 * SR))
            buf[i0 + i] += vol * env * math.sin(2 * math.pi * freq * i / SR)

    t = 0.0
    for seg in segments:
        kind, dur = seg["kind"], seg["dur"]
        if kind == "work":
            beep(t, 660, 0.15)
            beep(t + 0.18, 990, 0.30)
        elif kind == "rest":
            beep(t, 523, 0.15)
            beep(t + 0.18, 392, 0.30)
        elif kind == "outro":
            for j, f in enumerate((523, 659, 784)):
                beep(t + 0.22 * j, f, 0.35, 0.3)
        for k in (3, 2, 1):
            if dur >= k + 1:
                beep(t + dur - k, 880, 0.10, 0.28)
        t += dur

    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        frames = bytearray()
        for v in buf:
            v = max(-1.0, min(1.0, v))
            frames += struct.pack("<h", int(v * 32767))
        wf.writeframes(bytes(frames))


# ----------------------------------------------------------------------------
# Assemblage
# ----------------------------------------------------------------------------

def build_segments():
    segs = [{"kind": "intro", "dur": INTRO_S}]
    for i in range(len(EXOS)):
        segs.append({"kind": "work", "dur": WORK_S, "idx": i})
        if i < len(EXOS) - 1:
            segs.append({"kind": "rest", "dur": REST_S, "idx": i + 1})
    segs.append({"kind": "outro", "dur": OUTRO_S})
    return segs


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "workout.mp4"
    segments = build_segments()
    total_dur = sum(s["dur"] for s in segments)
    print(f"Durée totale : {total_dur} s ({total_dur // 60} min {total_dur % 60:02d})")

    wav_path = out.rsplit(".", 1)[0] + "_audio.wav"
    print("Synthèse audio…")
    synth_audio(segments, total_dur, wav_path)

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg, "-y",
        "-f", "rawvideo", "-vcodec", "rawvideo",
        "-s", f"{W}x{H}", "-pix_fmt", "rgb24", "-r", str(FPS), "-i", "-",
        "-i", wav_path,
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart",
        out,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    bg = make_background()
    total_frames = total_dur * FPS
    frame_no = 0
    elapsed_before = 0.0
    for seg in segments:
        for f in range(seg["dur"] * FPS):
            t_in = f / FPS
            img = render_frame(bg, seg, t_in, elapsed_before + t_in, total_dur)
            proc.stdin.write(img.tobytes())
            frame_no += 1
            if frame_no % (FPS * 30) == 0:
                print(f"  {frame_no}/{total_frames} images…")
        elapsed_before += seg["dur"]

    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise SystemExit("ffmpeg a échoué")
    print(f"OK → {out}")


if __name__ == "__main__":
    main()
