#!/usr/bin/env bash
# Builds the server package: release/bookpos-server-<date>.zip
# Contents: public/ (the app, production build without demo data), api/ (PHP), deploy/ (scripts)
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:server
STAMP="$(date +%Y%m%d-%H%M)"
OUT="release/bookpos-server"
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r dist-server "$OUT/public"
mkdir -p "$OUT/api"; cp server/*.php server/.htaccess server/schema.sql "$OUT/api/"; rm -f "$OUT/api/config.php"
mkdir -p "$OUT/deploy"; cp deploy/install.sh deploy/backup.sh deploy/restore.sh "$OUT/deploy/"
cp deploy/SERVER-GUIDE.md "$OUT/README.md"
echo "$STAMP" > "$OUT/VERSION"
(cd release && rm -f "bookpos-server-$STAMP.zip" && zip -qr "bookpos-server-$STAMP.zip" bookpos-server)
echo "Package: release/bookpos-server-$STAMP.zip"
