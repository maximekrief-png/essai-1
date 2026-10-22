"""Audit des coordonnées : sites, e-mails, téléphones, NPA, incohérences entre éditions.

Usage : python3 -I tools/audit_data.py  → rapport sur la sortie standard (JSON lignes)
"""
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TLDS = {"ch", "com", "fr", "de", "it", "net", "org", "info", "swiss", "eu", "li", "at", "biz", "be", "uk", "co", "io", "us", "lu", "nl", "es", "cn", "jp", "travel", "museum", "edu", "int", "gov", "global", "group", "tech", "watch", "law", "health", "immo", "ag", "sa", "online", "media", "news", "store", "shop", "pro", "berlin", "zuerich", "zurich", "geneve", "bern", "lausanne"}


def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def domain(w):
    w = fold(w).strip().replace("https://", "").replace("http://", "")
    return w.split("/")[0].removeprefix("www.")


issues = []


def add(mag, kind, slug, field, value, msg):
    issues.append({"mag": mag, "kind": kind, "slug": slug, "field": field, "value": value, "msg": msg})


phones_by_company = defaultdict(set)
for f in sorted((ROOT / "data" / "magazines").glob("*.json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    mag = d["slug"]
    for c in d["companies"]:
        s = c.get("slug")
        w = (c.get("website") or "").strip()
        e = (c.get("email") or "").strip()
        p = (c.get("phone") or "").strip()
        pc = (c.get("postalCode") or "").strip()
        if w:
            dm = domain(w)
            if " " in w or not re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", dm or ""):
                add(mag, "c", s, "website", w, "format de site invalide")
            elif dm.split(".")[-1] not in TLDS:
                add(mag, "c", s, "website", w, "extension inconnue")
            if "@" in w:
                add(mag, "c", s, "website", w, "e-mail dans le champ site")
        if e:
            if not re.fullmatch(r"[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", e):
                add(mag, "c", s, "email", e, "format d'e-mail invalide")
            elif fold(e).split("@")[1].split(".")[-1] not in TLDS:
                add(mag, "c", s, "email", e, "extension inconnue")
        if w and e and "@" in e:
            ed = fold(e).split("@")[1]
            wd = domain(w)
            generic = ("gmail", "bluewin", "hotmail", "yahoo", "gmx", "outlook", "sunrise", "vtx", "net2000", "hispeed", "swissonline", "romandie", "freesurf", "bluemail")
            if ed != wd and not ed.endswith("." + wd) and not wd.endswith("." + ed) and not any(g in ed for g in generic):
                a, b = ed.split(".")[0], wd.split(".")[0]
                # domaines presque identiques = coquille probable
                import difflib
                r = difflib.SequenceMatcher(None, a, b).ratio()
                if r >= 0.75:
                    add(mag, "c", s, "website/email", f"{w} | {e}", f"domaines presque identiques ({r:.2f})")
        if p:
            digits = re.sub(r"\D", "", p)
            if "++" in p or p.count("(") != p.count(")"):
                add(mag, "c", s, "phone", p, "ponctuation anormale")
            if digits.startswith("41") or p.startswith("+41") or p.startswith("0041"):
                nat = re.sub(r"^(0041|41)", "", digits)
                nat = nat.removeprefix("0")
                if len(nat) != 9:
                    add(mag, "c", s, "phone", p, f"numéro suisse de {len(nat)} chiffres (9 attendus)")
            elif digits.startswith("0") and len(digits) not in (10,):
                if not digits.startswith("033") and not digits.startswith("0033"):
                    add(mag, "c", s, "phone", p, f"numéro national de {len(digits)} chiffres (10 attendus)")
            elif not digits.startswith("0") and not p.startswith("+"):
                add(mag, "c", s, "phone", p, "indicatif manquant")
            phones_by_company[s].add(digits[-9:])
        if pc and (c.get("country") in ("", "Suisse", None)) and not re.fullmatch(r"\d{4}", pc):
            add(mag, "c", s, "postalCode", pc, "NPA suisse invalide")
    for a in d["articles"]:
        sm = a.get("summary") or ""
        if "non disponible" in sm.lower() or len(sm.split()) < 40:
            add(mag, "a", a.get("slug"), "summary", sm[:80], f"résumé court ou provisoire ({len(sm.split())} mots)")
for s, ph in phones_by_company.items():
    if len(ph) > 1:
        issues.append({"mag": "*", "kind": "c", "slug": s, "field": "phone", "value": sorted(ph), "msg": "téléphones différents selon les éditions"})
for i in issues:
    print(json.dumps(i, ensure_ascii=False))
