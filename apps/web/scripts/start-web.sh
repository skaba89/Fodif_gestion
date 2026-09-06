#!/usr/bin/env sh
set -eu

# Production safety gate: a PPD/PROD instance must never start with the presentation/demo flag.
# Qualification (REC) may deliberately enable DEMO_MODE so synthetic data remains visibly marked.
case "${APP_ENV:-}" in
  PPD|PROD)
    if [ "${DEMO_MODE:-false}" = "true" ]; then
      echo "Refusing to start: DEMO_MODE=true is forbidden when APP_ENV=${APP_ENV}." >&2
      exit 1
    fi
    ;;
esac

exec node node_modules/next/dist/bin/next start -p "${PORT:-3000}"
