"""Extrait les photos des PDF locaux pour chaque article / entreprise.

Lit data/magazines/*.json ; pour chaque élément qui a des `pdfPages`, extrait les images
de ces pages (pdfimages), écarte logos et aplats, et écrit les meilleures en WebP dans
docs/assets/img/<pdf>/. Produit data/images.json : {"articles": {"mag:slug": [...]}, "companies": {...}}.

Usage : python3 -I tools/extract_images.py
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter, ImageStat

Image.MAX_IMAGE_PIXELS = 200_000_000

ROOT = Path(__file__).resolve().parent.parent
WORK = Path(os.environ.get("WORK", "/tmp/claude-0/-home-user-essai-1/47dc13f7-8829-53ad-81e9-612d09b1bf8b/scratchpad"))
OUT = ROOT / "docs" / "assets" / "img"
MAX_W, MAX_H = 1400, 1000

_cache = {}  # (pdf, page) -> [chemins webp relatifs à docs/]


def good(w, h, small):
    """small : version réduite (≤ 256 px) de l'image, déjà en niveaux de gris."""
    if w < 380 or h < 260 or w * h < 150_000:
        return False
    if not 0.42 <= w / h <= 2.8:
        return False
    st = ImageStat.Stat(small.resize((64, 64)))
    if st.stddev[0] < 18:  # aplat, fond uni
        return False
    if st.mean[0] > 242:  # page quasi blanche (texte)
        return False
    # Dégradés et masques de transparence : très peu de contours
    t = small.copy()
    t.thumbnail((128, 128))
    if ImageStat.Stat(t.filter(ImageFilter.FIND_EDGES)).mean[0] < 12:
        return False
    return True


def listed(pdf, page):
    """num -> (couleur, taux de compression %) d'après pdfimages -list."""
    out = subprocess.run(["pdfimages", "-list", "-f", str(page), "-l", str(page), str(pdf)], capture_output=True, text=True).stdout
    info = {}
    for line in out.splitlines()[2:]:
        c = line.split()
        if len(c) >= 15 and c[2] == "image":
            try:
                info[int(c[1])] = (c[5], float(c[-1].rstrip("%")))
            except ValueError:
                pass
    return info


def page_images(pdf_slug, page):
    """Extrait les photos d'une page ; une seule image décodée en mémoire à la fois."""
    key = (pdf_slug, page)
    if key in _cache:
        return _cache[key]
    pdf = WORK / "pdfs" / f"{pdf_slug}.pdf"
    res = []
    if pdf.exists():
        with tempfile.TemporaryDirectory(dir=WORK) as tmp:
            subprocess.run(["pdfimages", "-q", "-f", str(page), "-l", str(page), "-png", str(pdf), f"{tmp}/i"], check=False)
            cands = []
            info = listed(pdf, page)
            for f in sorted(Path(tmp).glob("i-*.png")):
                color, ratio = info.get(int(f.stem.split("-")[1]), ("", 100.0))
                # palettes indexées et images ultra-compressibles = graphismes, pas des photos
                if color == "index" or ratio < 2.5:
                    continue
                try:
                    with Image.open(f) as im:
                        w, h = im.size
                        if w * h > 60_000_000 or w < 380 or h < 260:
                            continue
                        im.draft("RGB", (w // 4, h // 4))
                        small = im.convert("L")
                        small.thumbnail((256, 256))
                except Exception:
                    continue
                if good(w, h, small):
                    fp = hashlib.md5(small.resize((12, 12)).point(lambda v: v // 32).tobytes()).hexdigest()[:12]
                    cands.append((w * h, f, fp))
            cands.sort(reverse=True)
            seen = set()
            for _, f, fp in cands[:5]:
                if fp in seen:
                    continue
                seen.add(fp)
                dest = OUT / pdf_slug / f"p{page:03d}-{fp}.webp"
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    with Image.open(f) as im:
                        im = im.convert("RGB")
                        im.thumbnail((MAX_W, MAX_H), Image.LANCZOS)
                        im.save(dest, "WEBP", quality=74, method=4)
                res.append(str(dest.relative_to(ROOT / "docs")))
    _cache[key] = res
    return res


PAGEMAP = {}


SHARED = set()  # (kind, pdf, page) utilisées par plusieurs fiches du même magazine


def shared_pages(mag):
    """Pages (pdf, n°) citées par plusieurs entreprises ou plusieurs articles : photo ambiguë."""
    out = set()
    for kind, items in (("companies", mag.get("companies", [])), ("articles", mag.get("articles", []))):
        seen = {}
        for it in items:
            pdf_slug = it.get("imagePdf") or mag["slug"]
            for p in set(it.get("pdfPages") or []):
                seen.setdefault((pdf_slug, p), set()).add(it.get("slug"))
        out |= {(kind, k[0], k[1]) for k, v in seen.items() if len(v) > 1}
    return out


def collect(item, mag, limit, kind):
    pages = [p for p in (item.get("pdfPages") or []) if (kind, item.get("imagePdf") or mag["slug"], p) not in SHARED]
    pdf_slug = item.get("imagePdf") or mag["slug"]
    if not pages or not (WORK / "pdfs" / f"{pdf_slug}.pdf").exists():
        # pages retrouvées dans le PDF complet du site (tools/match_pages.py)
        m = PAGEMAP.get(kind, {}).get(f"{mag['slug']}:{item.get('slug')}")
        if m:
            pages, pdf_slug = m["pages"], m["pdf"]
    out = []
    for p in pages[:6]:
        if not isinstance(p, int) or p < 1:
            continue
        for src in page_images(pdf_slug, p):
            if src not in out:
                out.append(src)
        if len(out) >= limit:
            break
    return out[:limit]


def main():
    global PAGEMAP
    pm = ROOT / "data" / "pagemap.json"
    PAGEMAP = json.loads(pm.read_text(encoding="utf-8")) if pm.exists() else {}
    result = {"articles": {}, "companies": {}}
    files = sorted((ROOT / "data" / "magazines").glob("*.json"))
    for f in files:
        mag = json.loads(f.read_text(encoding="utf-8"))
        mag.setdefault("slug", f.stem)
        SHARED.clear()
        SHARED.update(shared_pages(mag))
        n = 0
        for a in mag.get("articles", []):
            imgs = collect(a, mag, 6, "articles")
            if imgs:
                result["articles"][f"{mag['slug']}:{a.get('slug')}"] = imgs
                n += 1
        for c in mag.get("companies", []):
            imgs = collect(c, mag, 4, "companies")
            if imgs:
                result["companies"][f"{mag['slug']}:{c.get('slug')}"] = imgs
                n += 1
        print(f"{mag['slug']}: {n} éléments illustrés", file=sys.stderr)
    (ROOT / "data" / "images.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(result['articles'])} articles, {len(result['companies'])} entreprises avec photos", file=sys.stderr)


if __name__ == "__main__":
    main()
