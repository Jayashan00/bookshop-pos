#!/usr/bin/env bash
# Nodemor Bookshop POS nightly server backup.  Usage: bookpos-backup /var/www/bookpos-<domain>
# Makes two independent copies every night and keeps 35 days:
#   db-YYYY-MM-DD.sql.gz         full database dump (restore with bookpos-restore)
#   bookpos-YYYY-MM-DD.json.gz   full export in Nodemor Bookshop POS backup format (restore in the app)
set -euo pipefail
SITE="${1:?Usage: bookpos-backup /var/www/bookpos-<domain>}"
CONF="$SITE/config.php"
[ -f "$CONF" ] || { echo "No config at $CONF"; exit 1; }
DOMAIN="$(basename "$SITE" | sed 's/^bookpos-//')"
DBNAME="$(php -r "\$c=require '$CONF'; echo \$c['db_name'];")"
OUT="/var/backups/bookpos/$DOMAIN"
mkdir -p "$OUT"; chmod 700 "$OUT"
DAY="$(date +%F)"
mysqldump --single-transaction --quick --routines "$DBNAME" | gzip -9 > "$OUT/db-$DAY.sql.gz.tmp"
mv "$OUT/db-$DAY.sql.gz.tmp" "$OUT/db-$DAY.sql.gz"
php "$SITE/public/api/export-cli.php" "$OUT/bookpos-$DAY.json.tmp"
gzip -9 -c "$OUT/bookpos-$DAY.json.tmp" > "$OUT/bookpos-$DAY.json.gz"; rm -f "$OUT/bookpos-$DAY.json.tmp"
find "$OUT" -name '*.gz' -mtime +35 -delete
echo "$(date '+%F %T') backup OK: $(du -sh "$OUT/db-$DAY.sql.gz" | cut -f1) db, $(du -sh "$OUT/bookpos-$DAY.json.gz" | cut -f1) json"
