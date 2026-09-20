#!/usr/bin/env bash
set -euo pipefail

# Render's Docker Command parser must only invoke this file. Keeping the sequence here avoids
# nested shell quoting being preserved and interpreted as a single executable name.
metrics_token="${METRICS_TOKEN:-}"
if (( ${#metrics_token} < 32 )); then
  echo "FATAL: METRICS_TOKEN must contain at least 32 characters before starting fodip-api." >&2
  exit 1
fi

node scripts/run-migrations.js
node scripts/bootstrap-super-admin.js
exec node dist/main.js
