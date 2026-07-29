#!/usr/bin/env bash
# Regenerate the subset Noto Sans JP faces in assets/fonts/.
#
# The full faces are 5.2 MB each and this app only ever renders kana, so we ship
# a subset covering the kana blocks plus CJK punctuation and fullwidth forms.
# That is ~251 KB per weight — the full pair would otherwise be ~6x the entire
# web bundle.
#
# Requires `uv` (https://docs.astral.sh/uv/) and the @expo-google-fonts/noto-sans-jp
# devDependency, which exists only as the source for this script and is never
# imported by the app.
#
# Usage: npm run fonts:subset

set -euo pipefail

cd "$(dirname "$0")/.."

SRC="node_modules/@expo-google-fonts/noto-sans-jp"
OUT="assets/fonts"

if [ ! -d "$SRC" ]; then
  echo "error: $SRC not found — run 'npm install' first." >&2
  exit 1
fi

mkdir -p "$OUT"

# U+3000-303F CJK punctuation · U+3041-309F hiragana · U+30A0-30FF katakana
# · U+FF01-FF60 fullwidth forms
RANGES="U+3000-303F,U+3041-309F,U+30A0-30FF,U+FF01-FF60"

for weight in 200ExtraLight 300Light; do
  uv tool run --quiet --from fonttools pyftsubset \
    "$SRC/$weight/NotoSansJP_$weight.ttf" \
    --output-file="$OUT/NotoSansJP_$weight-kana.ttf" \
    --unicodes="$RANGES" \
    --layout-features='*' \
    --no-hinting \
    --desubroutinize
  echo "wrote $OUT/NotoSansJP_$weight-kana.ttf"
done
