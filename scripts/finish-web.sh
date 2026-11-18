#!/usr/bin/env bash
# Post-processes `expo export --platform web`: fills in the base path used by public/index.html and
# public/manifest.json, and copies index.html to 404.html so deep links work on static hosts.
# Usage: scripts/finish-web.sh [/base-path]
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${1:-}"
for f in dist/index.html dist/manifest.json; do
  sed -i "s#__BASE__#${BASE}#g" "$f"
done
cp dist/index.html dist/404.html
