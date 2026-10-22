"""Contrôle du site généré : liens internes cassés, images manquantes, valeurs vides.

Usage : python3 -I tools/check_site.py
"""
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import unquote

DOCS = Path(__file__).resolve().parent.parent / "docs"
ATTR = re.compile(r'(?:href|src)="([^"#?]*)[^"]*"')
BAD = re.compile(r">\s*(undefined|null|NaN|\[object Object\])\s*<|\b(undefined|NaN)\b(?=[^<]*</)")

broken = Counter()
examples = {}
bad_values = []
pages = list(DOCS.rglob("*.html"))
for f in pages:
    html = f.read_text(encoding="utf-8")
    for url in ATTR.findall(html):
        if not url or re.match(r"^(https?:|mailto:|tel:|data:|//)", url):
            continue
        target = (f.parent / unquote(url)).resolve()
        if url.endswith("/") or target.is_dir():
            target = target / "index.html"
        if not target.exists():
            key = str(target.relative_to(DOCS)) if DOCS in target.parents else str(target)
            broken[key] += 1
            examples.setdefault(key, str(f.relative_to(DOCS)))
    if BAD.search(html):
        bad_values.append(str(f.relative_to(DOCS)))
print(f"{len(pages)} pages HTML contrôlées")
print(f"{len(broken)} cibles introuvables ({sum(broken.values())} liens)")
for k, n in broken.most_common(15):
    print(f"  {n:4} × {k}   (ex. {examples[k]})")
print(f"{len(bad_values)} pages avec valeur vide (undefined/null/NaN)")
for p in bad_values[:10]:
    print("  ", p)
sys.exit(1 if broken or bad_values else 0)
