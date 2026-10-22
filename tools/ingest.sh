#!/usr/bin/env bash
# Décode un PDF téléchargé via le connecteur Google Drive (JSON {content: base64})
# puis extrait : texte page par page, couverture (miniature), liste des images.
# Usage : tools/ingest.sh <fichier-json-du-connecteur> <slug>
set -euo pipefail
SRC="$1"; SLUG="$2"
WORK="${WORK:-/tmp/claude-0/-home-user-essai-1/47dc13f7-8829-53ad-81e9-612d09b1bf8b/scratchpad}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$WORK/pdfs" "$WORK/text/$SLUG" "$REPO/site/assets/covers"
PDF="$WORK/pdfs/$SLUG.pdf"
jq -r .content "$SRC" | base64 -d > "$PDF"
PAGES=$(pdfinfo "$PDF" | awk '/^Pages:/{print $2}')
pdftotext -q "$PDF" "$WORK/text/$SLUG/all.txt"
# Découpe par saut de page (\f) -> p001.txt, p002.txt...
python3 -I - "$WORK/text/$SLUG" <<'PY'
import sys, os
d = sys.argv[1]
pages = open(os.path.join(d, "all.txt"), encoding="utf-8", errors="replace").read().split("\f")
for i, t in enumerate(pages, 1):
    if i > len(pages) or (i == len(pages) and not t.strip()):
        break
    open(os.path.join(d, f"p{i:03d}.txt"), "w", encoding="utf-8").write(t)
PY
# Couverture : page 1 rendue en 480 px de large (webp)
pdftoppm -f 1 -l 1 -scale-to-x 480 -scale-to-y -1 -jpeg -jpegopt quality=85 "$PDF" "$WORK/cover-$SLUG"
convert "$WORK"/cover-"$SLUG"*.jpg -quality 78 "$REPO/site/assets/covers/$SLUG.webp"
rm -f "$WORK"/cover-"$SLUG"*.jpg
CHARS=$(wc -c < "$WORK/text/$SLUG/all.txt")
echo "{\"slug\":\"$SLUG\",\"pages\":$PAGES,\"textChars\":$CHARS}"
