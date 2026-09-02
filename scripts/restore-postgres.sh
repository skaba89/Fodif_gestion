#!/usr/bin/env bash
set -euo pipefail

# FODIP Digital 2030 - Axe C6 (docs/14-ROADMAP-SAAS-PREMIUM.md)
#
# Restores a pg_dump custom-format archive (see backup-postgres.sh) into the running
# docker-compose Postgres, through the same postgres:16.10-alpine container (client/server
# version match, no host pg_restore required).
#
# By default the target is the live database (POSTGRES_DB, "fodip" unless overridden) - this is
# the actual disaster-recovery path, so it refuses to run without --force to guard against
# fat-fingering a restore over live data. Pass --target-db to restore into a different (e.g.
# scratch) database instead, the normal way to verify a backup without touching the live one -
# see test-backup-restore.sh, which does exactly that on every CI run.
#
# Usage: scripts/restore-postgres.sh <dump-file> [--target-db NAME] [--force]

DUMP_FILE="${1:?Usage: restore-postgres.sh <dump-file> [--target-db NAME] [--force]}"
shift

LIVE_DB="${POSTGRES_DB:-fodip}"
TARGET_DB="$LIVE_DB"
FORCE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --target-db) TARGET_DB="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ "$TARGET_DB" = "$LIVE_DB" ] && [ -z "$FORCE" ]; then
  echo "Refusing to restore into '$TARGET_DB' without --force: this looks like the live database." >&2
  echo "Restore into a scratch database with --target-db instead, or pass --force if this is a genuine disaster-recovery restore." >&2
  exit 1
fi

docker compose exec -T postgres pg_restore \
  --username "${POSTGRES_USER:-fodip}" \
  --dbname "$TARGET_DB" \
  --no-owner --no-privileges --clean --if-exists \
  < "$DUMP_FILE"

echo "Restored $DUMP_FILE into database '$TARGET_DB'."
