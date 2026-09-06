#!/usr/bin/env bash
set -euo pipefail

# Render's Docker Command parser must only invoke this file. Keeping the sequence here avoids
# nested shell quoting being preserved and interpreted as a single executable name.
node scripts/run-migrations.js
node scripts/bootstrap-super-admin.js
exec node dist/main.js
