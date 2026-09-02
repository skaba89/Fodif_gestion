#!/usr/bin/env bash
set -euo pipefail

# FODIP Digital 2030 - Axe C6 (docs/14-ROADMAP-SAAS-PREMIUM.md)
#
# Dumps the running docker-compose Postgres to a timestamped, compressed custom-format archive
# (pg_dump -Fc: supports selective/parallel restore and is smaller than a plain .sql file). Runs
# pg_dump inside the same postgres:16.10-alpine container the database itself runs in, so client
# and server tool versions always match exactly - no local pg_dump install required on the host,
# the same reasoning database/*.sql migrations already run through that container rather than a
# host-installed psql.
#
# Usage: scripts/backup-postgres.sh [output-directory]
# Requires: the docker compose stack running (`docker compose up`).

OUT_DIR="${1:-backups}"
mkdir -p "$OUT_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/fodip-${TIMESTAMP}.dump"

docker compose exec -T postgres pg_dump \
  --username "${POSTGRES_USER:-fodip}" \
  --dbname "${POSTGRES_DB:-fodip}" \
  --format=custom \
  --no-owner --no-privileges \
  > "$OUT_FILE"

echo "Backup written to $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"
