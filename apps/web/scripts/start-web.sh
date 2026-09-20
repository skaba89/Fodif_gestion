#!/usr/bin/env sh
set -eu

# Hosted environments use persistent APIs and databases. Pre-production and production must fail
# closed rather than exposing a demo-labelled platform; local/CI may still opt into demo fixtures.
case "${APP_ENV:-}" in
  PPD|PROD)
    if [ "${DEMO_MODE:-false}" = "true" ]; then
      echo "Refusing to start: DEMO_MODE=true is forbidden when APP_ENV=${APP_ENV}." >&2
      exit 1
    fi
    ;;
esac

exec node node_modules/next/dist/bin/next start -p "${PORT:-3000}"
