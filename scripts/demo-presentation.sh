#!/usr/bin/env bash
# Mission "présentation Directeur général", axe 9 (mode présentation) - the real, verified
# start command for the DG demo stack. Wraps `docker compose -f docker-compose.yml -f
# docker-compose.presentation.yml`, NOT the mission text's own literal example
# (`docker compose --profile presentation up --build`) - see docker-compose.presentation.yml's
# header comment for why a Compose profile cannot toggle this env var on an always-on service.
# The mission text itself allows this alternative ("un profil ou une configuration dédiée"), so
# this script is that configuration dédiée, documented here rather than left unshippable.
#
# Same local stack as `docker compose up` in every other respect: PostgreSQL and MinIO in Docker,
# no Azure, RBAC and MFA fully enforced, only DEMO_MODE=true added on the `web` service so the
# app-wide "Données de démonstration - aucune donnée réelle" banner (AppShell.tsx, GET
# /api/config) is shown. Any extra arguments are forwarded to `docker compose up` unchanged, e.g.
# `scripts/demo-presentation.sh -d` to run detached.
set -euo pipefail
cd "$(dirname "$0")/.."

exec docker compose -f docker-compose.yml -f docker-compose.presentation.yml up --build "$@"
