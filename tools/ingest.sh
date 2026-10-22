#!/usr/bin/env bash
# Prépare un PDF de magazine : texte page par page, couverture (miniature).
# Source : soit un PDF, soit le JSON {content: base64} renvoyé par le connecteur Google Drive.
# Usage : tools/ingest.sh <fichier.pdf|fichier.json> <slug> [nom-couverture]
#   - PDF copié dans $WORK/pdfs/<slug>.pdf, texte dans $WORK/text/<slug>/p001.txt…
#   - couverture écrite dans docs/assets/covers/<nom-couverture>.webp (par défaut <slug>)
set -euo pipefail
SRC="$1"; SLUG="$2"; COVER="${3:-$SLUG}"
WORK="${WORK:-/tmp/claude-0/-home-user-essai-1/47dc13f7-8829-53ad-81e9-612d09b1bf8b/scratchpad}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$WORK/pdfs" "$WORK/text/$SLUG" "$REPO/docs/assets/covers"
PDF="$WORK/pdfs/$SLUG.pdf"
case "$SRC" in
  *.pdf) [ "$SRC" -ef "$PDF" ] || cp "$SRC" "$PDF" ;;
  *) jq -r .content "$SRC" | base64 -d > "$PDF" ;;
esac
PAGES=$(pdfinfo "$PDF" 2>/dev/null | awk '/^Pages:/{print $2}')
pdftotext -q "$PDF" "$WORK/text/$SLUG/all.txt"
# Découpe par saut de page (\f) -> p001.txt, p002.txt...
python3 -I - "$WORK/text/$SLUG" <<'PY'
import sys, os
d = sys.argv[1]
pages = open(os.path.join(d, "all.txt"), encoding="utf-8", errors="replace").read().split("\f")
if pages and not pages[-1].strip():
    pages = pages[:-1]
for i, t in enumerate(pages, 1):
    open(os.path.join(d, f"p{i:03d}.txt"), "w", encoding="utf-8").write(t)
PY
# Couverture : page 1 rendue en 480 px de large (webp)
pdftoppm -q -f 1 -l 1 -scale-to-x 480 -scale-to-y -1 -jpeg -jpegopt quality=88 "$PDF" "$WORK/cover-$SLUG"
convert "$WORK"/cover-"$SLUG"*.jpg -quality 80 "$REPO/docs/assets/covers/$COVER.webp"
rm -f "$WORK"/cover-"$SLUG"*.jpg
CHARS=$(wc -c < "$WORK/text/$SLUG/all.txt")
echo "{\"slug\":\"$SLUG\",\"pages\":$PAGES,\"textChars\":$CHARS}"
