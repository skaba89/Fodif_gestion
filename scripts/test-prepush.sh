#!/usr/bin/env bash
set -euo pipefail
node --check apps/api/src/security-policy.js
node --check apps/api/src/pme-policy.js
node --test apps/api/test/security-policy.test.cjs apps/api/test/pme-policy.test.cjs
python scripts/check-migrations.py
