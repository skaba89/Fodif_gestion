#!/usr/bin/env bash
set -euo pipefail
node --check apps/api/src/security-policy.js
node --check apps/api/src/pme-policy.js
node --check apps/api/src/document-policy.js
node --check apps/api/src/agent-policy.js
node --test apps/api/test/security-policy.test.cjs apps/api/test/pme-policy.test.cjs apps/api/test/document-policy.test.cjs apps/api/test/agent-policy.test.cjs
python scripts/check-migrations.py
python scripts/check-docker.py
bash -n scripts/docker-smoke.sh
pnpm -r lint
