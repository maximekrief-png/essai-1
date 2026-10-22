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

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parent.parent
WORK = Path(os.environ.get("WORK", "/tmp/claude-0/-home-user-essai-1/47dc13f7-8829-53ad-81e9-612d09b1bf8b/scratchpad"))
OUT = ROOT / "docs" / "assets" / "img"
MAX_W, MAX_H = 1400, 1000

_cache = {}  # (pdf, page) -> [chemins webp relatifs à docs/]


def good(im):
    w, h = im.size
    if w < 380 or h < 260 or w * h < 150_000:
        return False
    if not 0.42 <= w / h <= 2.8:
        return False
    st = ImageStat.Stat(im.convert("L").resize((64, 64)))
    if st.stddev[0] < 18:  # aplat, fond uni
        return False
    if st.mean[0] > 242:  # page quasi blanche (texte)
        return False
    return True


def page_images(pdf_slug, page):
    key = (pdf_slug, page)
    if key in _cache:
        return _cache[key]
    pdf = WORK / "pdfs" / f"{pdf_slug}.pdf"
    res = []
    if pdf.exists():
        with tempfile.TemporaryDirectory(dir=WORK) as tmp:
            subprocess.run(["pdfimages", "-q", "-f", str(page), "-l", str(page), "-png", str(pdf), f"{tmp}/i"], check=False)
            cands = []
            for f in sorted(Path(tmp).glob("i-*.png")):
                try:
                    im = Image.open(f)
                    im.load()
                except Exception:
                    continue
                if im.mode not in ("RGB", "L"):
                    im = im.convert("RGB")
                if good(im):
                    cands.append(im)
            cands.sort(key=lambda im: im.size[0] * im.size[1], reverse=True)
            seen = set()
            for im in cands[:5]:
                thumb = im.convert("L").resize((12, 12))
                fp = hashlib.md5(bytes(p // 32 for p in thumb.getdata())).hexdigest()[:12]
                if fp in seen:
                    continue
                seen.add(fp)
                im = im.convert("RGB")
                im.thumbnail((MAX_W, MAX_H), Image.LANCZOS)
                dest = OUT / pdf_slug / f"p{page:03d}-{fp}.webp"
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    im.save(dest, "WEBP", quality=74, method=5)
                res.append(str(dest.relative_to(ROOT / "docs")))
    _cache[key] = res
    return res


def collect(item, mag, limit):
    pages = item.get("pdfPages") or []
    pdf_slug = item.get("imagePdf") or mag["slug"]
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
    result = {"articles": {}, "companies": {}}
    files = sorted((ROOT / "data" / "magazines").glob("*.json"))
    for f in files:
        mag = json.loads(f.read_text(encoding="utf-8"))
        mag.setdefault("slug", f.stem)
        n = 0
        for a in mag.get("articles", []):
            imgs = collect(a, mag, 6)
            if imgs:
                result["articles"][f"{mag['slug']}:{a.get('slug')}"] = imgs
                n += 1
        for c in mag.get("companies", []):
            imgs = collect(c, mag, 4)
            if imgs:
                result["companies"][f"{mag['slug']}:{c.get('slug')}"] = imgs
                n += 1
        print(f"{mag['slug']}: {n} éléments illustrés", file=sys.stderr)
    (ROOT / "data" / "images.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(result['articles'])} articles, {len(result['companies'])} entreprises avec photos", file=sys.stderr)


if __name__ == "__main__":
    main()
