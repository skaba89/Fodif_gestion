#!/usr/bin/env bash
set -euo pipefail

for attempt in $(seq 1 60); do
  if curl --fail --silent http://localhost:4000/api/v1/health >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    echo "API did not become ready" >&2
    exit 1
  fi
  sleep 2
done

curl --fail --silent http://localhost:3000/agent/connexion >/dev/null

login_response=$(curl --fail --silent \
  --request POST \
  --header 'content-type: application/json' \
  --data '{"email":"agent@fodip.local","password":"FodipDemo2026!"}' \
  http://localhost:4000/api/v1/auth/login)

access_token=$(LOGIN_RESPONSE="$login_response" python -c \
  'import json, os; print(json.loads(os.environ["LOGIN_RESPONSE"])["accessToken"])')

dossiers_response=$(curl --fail --silent \
  --header "authorization: Bearer $access_token" \
  http://localhost:4000/api/v1/agent/applications)

DOSSIERS_RESPONSE="$dossiers_response" python -c \
  'import json, os; body=json.loads(os.environ["DOSSIERS_RESPONSE"]); assert body["total"] >= 2; assert len(body["items"]) >= 2'

pme_login=$(curl --fail --silent \
  --request POST \
  --header 'content-type: application/json' \
  --data '{"email":"pme@fodip.local","password":"FodipDemo2026!"}' \
  http://localhost:4000/api/v1/auth/login)

pme_token=$(LOGIN_RESPONSE="$pme_login" python -c \
  'import json, os; print(json.loads(os.environ["LOGIN_RESPONSE"])["accessToken"])')

upload_response=$(printf '%b' '%PDF-1.7\nDocker smoke document\n' | curl --fail --silent \
  --request POST \
  --header "authorization: Bearer $pme_token" \
  --form 'typeDocument=RCCM' \
  --form 'file=@-;filename=rccm-demo.pdf;type=application/pdf' \
  http://localhost:4000/api/v1/documents/applications/60000000-0000-4000-8000-000000000003)

document_id=$(UPLOAD_RESPONSE="$upload_response" python -c \
  'import json, os; print(json.loads(os.environ["UPLOAD_RESPONSE"])["id"])')

curl --fail --silent \
  --header "authorization: Bearer $pme_token" \
  "http://localhost:4000/api/v1/documents/$document_id/download" \
  --output /dev/null

echo "Docker smoke test passed: web, API, auth, PostgreSQL, Agent workflow and MinIO document round-trip."
