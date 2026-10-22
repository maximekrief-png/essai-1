"""Retrouve les pages PDF de chaque article / entreprise quand l'extraction ne les donne pas.

Pour les magazines dont le PDF complet a été téléchargé depuis swissknowhow.ch
($WORK/text/web-<slug>/p001.txt…), on cherche dans le texte de chaque page les signaux
d'une entreprise (domaine web, e-mail, téléphone, nom), puis on estime le décalage entre
pagination imprimée et pages du PDF pour placer les articles.

Écrit data/pagemap.json : {"articles": {"mag:slug": {"pdf": "web-mag", "pages": [...]}}, "companies": {...}}
Usage : python3 -I tools/match_pages.py
"""
import json
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = Path(os.environ.get("WORK", "/tmp/claude-0/-home-user-essai-1/47dc13f7-8829-53ad-81e9-612d09b1bf8b/scratchpad"))
LEGAL = r"\b(sa|ag|sarl|gmbh|ltd|inc|cie|co|s a|the|la|le|les|de|du|des|et|und|der|die|das)\b"


def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def squash(s):
    return re.sub(r"[^a-z0-9]", "", fold(s))


def load_pages(pdf_slug):
    d = WORK / "text" / pdf_slug
    files = sorted(d.glob("p[0-9][0-9][0-9].txt"))
    return [squash(f.read_text(encoding="utf-8", errors="replace")) for f in files]


def first_int(s):
    m = re.findall(r"\d+", str(s or ""))
    return [int(x) for x in m[:2]]


def company_signals(c):
    sig = []
    w = fold(c.get("website", "")).replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
    if len(w) > 4:
        sig.append((squash(w), 10))
    e = fold(c.get("email", ""))
    if "@" in e:
        sig.append((squash(e), 8))
    p = re.sub(r"\D", "", c.get("phone", ""))
    if len(p) >= 8:
        sig.append((p[-7:], 6))
    n = squash(re.sub(LEGAL, " ", fold(c.get("name", "")).split("–")[0].split(" - ")[0]))
    if len(n) >= 5:
        sig.append((n, 4))
    return sig


def score_pages(pages, sig):
    scores = []
    for i, t in enumerate(pages, 1):
        s = sum(w for k, w in sig if k and k in t)
        scores.append((s, i))
    return scores


def best_pages(scores, limit=3):
    top = max(scores, default=(0, 0))
    if top[0] < 8:
        return []
    best = top[1]
    sel = [best]
    by = dict((i, s) for s, i in scores)
    for d in (-1, 1, -2, 2):
        j = best + d
        if len(sel) < limit and by.get(j, 0) >= 4:
            sel.append(j)
    return sorted(sel)


def main():
    out = {"articles": {}, "companies": {}}
    for f in sorted((ROOT / "data" / "magazines").glob("*.json")):
        mag = json.loads(f.read_text(encoding="utf-8"))
        slug = mag.get("slug", f.stem)
        pdf_slug = f"web-{slug}"
        pages = load_pages(pdf_slug)
        if not pages:
            continue
        n = len(pages)
        cpages = {}
        offsets = Counter()
        # Score de chaque entreprise sur chaque page : une page n'est attribuée qu'à
        # l'entreprise qui y est la plus présente (évite la photo du voisin de page).
        all_scores = {c["slug"]: score_pages(pages, company_signals(c)) for c in mag.get("companies", [])}
        page_best = Counter()
        for sc in all_scores.values():
            for s_, i in sc:
                page_best[i] = max(page_best[i], s_)
        for c in mag.get("companies", []):
            if c.get("pdfPages"):
                continue
            sc = [(s_ if s_ >= page_best[i] else 0, i) for s_, i in all_scores[c["slug"]]]
            sel = best_pages(sc)
            if sel:
                cpages[c["slug"]] = sel
                pr = first_int(c.get("page"))
                if pr:
                    offsets[sel[0] - pr[0]] += 1
        off = offsets.most_common(1)[0][0] if offsets else None
        # Décalage peu fiable (pagination incohérente) : on ne s'en sert pas
        if off is not None and offsets[off] < 0.5 * sum(offsets.values()):
            off = None
        for c in mag.get("companies", []):
            if c.get("pdfPages"):
                continue
            sel = cpages.get(c["slug"])
            if not sel and off is not None and first_int(c.get("page")):
                p = first_int(c.get("page"))[0] + off
                sel = [p] if 1 <= p <= n else []
            if sel:
                cpages[c["slug"]] = sel
                out["companies"][f"{slug}:{c['slug']}"] = {"pdf": pdf_slug, "pages": sel}
        na = 0
        for a in mag.get("articles", []):
            if a.get("pdfPages"):
                continue
            # D'abord les pages où l'entreprise liée a été retrouvée, sinon la pagination imprimée
            sel = []
            for cs in a.get("companies", []):
                sel += cpages.get(cs, [])
            sel = sorted(set(sel))[:3]
            pr = first_int(a.get("page"))
            if not sel and pr and off is not None:
                start = pr[0] + off
                end = (pr[1] + off) if len(pr) > 1 and pr[1] >= pr[0] else start
                sel = [p for p in range(start, min(end, start + 3) + 1) if 1 <= p <= n]
            if sel:
                out["articles"][f"{slug}:{a['slug']}"] = {"pdf": pdf_slug, "pages": sel}
                na += 1
        print(f"{slug}: décalage {off}, {len(cpages)} entreprises, {na} articles placés")
    (ROOT / "data" / "pagemap.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
