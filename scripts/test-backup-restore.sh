#!/usr/bin/env bash
set -euo pipefail

# FODIP Digital 2030 - Axe C6 (docs/14-ROADMAP-SAAS-PREMIUM.md)
#
# Proves a backup can actually be restored, not just created - "sauvegardes automatisées ET
# testées (restauration)" per the roadmap wording, not automated backups alone. Runs against the
# live docker-compose Postgres (see .github/workflows/ci.yml, right after the existing Docker
# smoke test): backs up the seeded database, restores it into a disposable scratch database, and
# compares every table's row count between the original and the restored copy. Exits non-zero on
# any mismatch, so a real regression in the dump/restore path fails CI rather than going unnoticed
# until an actual disaster-recovery attempt.

POSTGRES_USER="${POSTGRES_USER:-fodip}"
POSTGRES_DB="${POSTGRES_DB:-fodip}"
SCRATCH_DB="fodip_restore_test"
DUMP_DIR="$(mktemp -d)"
trap 'rm -rf "$DUMP_DIR"; docker compose exec -T postgres psql --username "$POSTGRES_USER" --dbname postgres -c "DROP DATABASE IF EXISTS $SCRATCH_DB;" >/dev/null 2>&1 || true' EXIT

psql_scalar() {
  # $1: database, $2: SQL. -A/-t: unaligned, tuples-only - a bare value, one per row.
  docker compose exec -T postgres psql --username "$POSTGRES_USER" --dbname "$1" --tuples-only --no-align --command "$2"
}

table_counts() {
  local db="$1" table
  psql_scalar "$db" \
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;" \
    | while IFS= read -r table; do
        [ -z "$table" ] && continue
        printf '%s %s\n' "$table" "$(psql_scalar "$db" "SELECT count(*) FROM \"$table\";")"
      done
}

echo "1/4 Backing up '$POSTGRES_DB'..."
bash scripts/backup-postgres.sh "$DUMP_DIR"
DUMP_FILE="$(find "$DUMP_DIR" -name '*.dump' -print -quit)"

echo "2/4 Creating scratch database '$SCRATCH_DB'..."
docker compose exec -T postgres psql --username "$POSTGRES_USER" --dbname postgres \
  --command "DROP DATABASE IF EXISTS $SCRATCH_DB;" --command "CREATE DATABASE $SCRATCH_DB;"

echo "3/4 Restoring into '$SCRATCH_DB'..."
bash scripts/restore-postgres.sh "$DUMP_FILE" --target-db "$SCRATCH_DB" --force

echo "4/4 Comparing row counts, table by table..."
original="$(table_counts "$POSTGRES_DB")"
restored="$(table_counts "$SCRATCH_DB")"

if [ "$original" != "$restored" ]; then
  echo "Row counts differ between the original and the restored database:" >&2
  diff <(echo "$original") <(echo "$restored") >&2 || true
  exit 1
fi

echo "Backup/restore verified: row counts match for every table."
