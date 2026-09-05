#!/usr/bin/env bash
set -euo pipefail
node --check apps/api/src/security-policy.js
node --check apps/api/scripts/bootstrap-super-admin.js
node --check apps/api/src/pme-policy.js
node --check apps/api/src/document-policy.js
node --check apps/api/src/agent-policy.js
node --check apps/api/src/scoring-policy.js
node --check apps/api/src/committee-policy.js
node --check apps/api/src/finance-policy.js
node --check apps/api/src/admin-policy.js
node --test apps/api/test/security-policy.test.cjs apps/api/test/bootstrap-super-admin.test.cjs apps/api/test/pme-policy.test.cjs apps/api/test/document-policy.test.cjs apps/api/test/agent-policy.test.cjs apps/api/test/scoring-policy.test.cjs apps/api/test/committee-policy.test.cjs apps/api/test/finance-policy.test.cjs apps/api/test/admin-policy.test.cjs
python scripts/check-node-version.py
python scripts/check-migrations.py
python scripts/check-docker.py
python scripts/check-render.py
python scripts/check-k8s.py
python scripts/check-release-workflow.py
python scripts/check-licenses.py
python scripts/check-institutional-readiness.py
python scripts/test-release-evidence.py
bash -n scripts/docker-smoke.sh
bash -n scripts/backup-postgres.sh
bash -n scripts/restore-postgres.sh
bash -n scripts/test-backup-restore.sh
pnpm -r lint
