"""Harmonise le format des coordonnées dans data/magazines/*.json.

- Téléphones suisses → « +41 (0)XX XXX XX XX » (numéros 08xx : « +41 (0)8XX XXX XXX »),
  plusieurs numéros séparés par « / ». Les numéros étrangers ou incomplets sont laissés tels quels.
- E-mails en minuscules.
- Sites : sans « http(s):// » ni « / » final, domaine en minuscules, « www. » conservé tel quel.

Usage : python3 -I tools/normalize_contacts.py   (affiche le nombre de champs modifiés)
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def fmt_ch(nat):
    """nat : 9 chiffres sans le 0 initial."""
    if nat.startswith("8"):
        return f"+41 (0){nat[:3]} {nat[3:6]} {nat[6:]}"
    return f"+41 (0){nat[:2]} {nat[2:5]} {nat[5:7]} {nat[7:]}"


def french(part):
    d = re.sub(r"\D", "", part)
    if re.match(r"^\s*(\+|00)\s*\(?33", part):
        d = d[4:] if d.startswith("0033") else d[2:]
        d = d.removeprefix("0")
        if len(d) == 9:
            return f"+33 (0){d[0]} {d[1:3]} {d[3:5]} {d[5:7]} {d[7:]}"
    return None


def swiss(part):
    d = re.sub(r"\D", "", part)
    if re.match(r"^\s*(\+|00)?\s*\(?\s*(33|49|39|43|44|1)\b", part) and not d.startswith("41"):
        return None  # numéro étranger
    if d.startswith("0041"):
        d = d[4:]
    elif d.startswith("41") and len(d) >= 11:
        d = d[2:]
    d = d.removeprefix("0")
    return fmt_ch(d) if len(d) == 9 else None


def phone(p):
    if not p:
        return p
    # « 091 646 21 36/46 » : deuxième numéro abrégé déjà développé ailleurs ; on découpe sur / ou ;
    parts = [x for x in re.split(r"\s*(?:/|;|\bou\b)\s*", p) if x.strip()]
    # on ne sépare que si chaque morceau est un numéro complet (sinon « / » fait partie du numéro)
    if len(parts) > 1 and any(len(re.sub(r"\D", "", x)) < 9 for x in parts):
        parts = [p]
    out = []
    for x in parts:
        s = swiss(x) or french(x)
        if s is None:
            # pas un numéro suisse complet : on ne garde que la ponctuation nettoyée
            out.append(re.sub(r"\+\s+", "+", re.sub(r"\s{2,}", " ", x.strip())))
        else:
            out.append(s)
    return " / ".join(out)


def website(w):
    if not w:
        return w
    w = w.strip()
    w = re.sub(r"^https?://", "", w, flags=re.I).rstrip("/")
    host, _, rest = w.partition("/")
    return host.lower() + (("/" + rest) if rest else "")


SPECIFIC = {  # corrections vérifiées dans le texte des PDF
    ("postalCode", "Neyruz", ""): "1740",
    ("postalCode", "Horgen", "8812"): "8810",
}

changed = 0
for f in sorted((ROOT / "data" / "magazines").glob("*.json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    before = json.dumps(d, ensure_ascii=False)
    for c in d["companies"]:
        for key, fn in (("phone", phone), ("website", website)):
            if c.get(key):
                new = fn(c[key])
                if new != c[key]:
                    c[key] = new
                    changed += 1
        if c.get("email") and c["email"] != c["email"].lower():
            c["email"] = c["email"].lower().strip()
            changed += 1
        if c.get("address") and "Rue de l'Argent 6" in c["address"]:
            c["address"] = c["address"].replace("Rue de l'Argent 6", "Rue d'Argent 6")
            changed += 1
        for (field, city, old), new in SPECIFIC.items():
            if (c.get("city") or "").strip() == city and (c.get(field) or "") == old:
                c[field] = new
                changed += 1
    if json.dumps(d, ensure_ascii=False) != before:
        f.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{changed} champs harmonisés")
