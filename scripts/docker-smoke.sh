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

for attempt in $(seq 1 60); do
  if curl --fail --silent http://localhost:3000/agent/connexion >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    echo "Web application did not become ready" >&2
    exit 1
  fi
  sleep 2
done

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

curl --fail --silent \
  --request POST \
  --header "authorization: Bearer $access_token" \
  http://localhost:4000/api/v1/agent/applications/60000000-0000-4000-8000-000000000002/claim \
  --output /dev/null

scoring_context=$(curl --fail --silent \
  --header "authorization: Bearer $access_token" \
  http://localhost:4000/api/v1/scoring/applications/60000000-0000-4000-8000-000000000002)

scoring_payload=$(SCORING_CONTEXT="$scoring_context" python -c \
  'import json, os; body=json.loads(os.environ["SCORING_CONTEXT"]); print(json.dumps({"criteres":[{"code":c["code"],"scoreObtenu":80,"commentaire":"Validé par le smoke test Docker"} for c in body["modele"]["criteres"]]}))')

curl --fail --silent \
  --request PUT \
  --header "authorization: Bearer $access_token" \
  --header 'content-type: application/json' \
  --data "$scoring_payload" \
  http://localhost:4000/api/v1/scoring/applications/60000000-0000-4000-8000-000000000002 \
  --output /dev/null

curl --fail --silent \
  --request POST \
  --header "authorization: Bearer $access_token" \
  --header 'content-type: application/json' \
  --data '{"statut":"PRET_COMITE","commentaire":"Scoring complet, transmission au comité"}' \
  http://localhost:4000/api/v1/agent/applications/60000000-0000-4000-8000-000000000002/review \
  --output /dev/null

committee_login=$(curl --fail --silent \
  --request POST \
  --header 'content-type: application/json' \
  --data '{"email":"comite@fodip.local","password":"FodipDemo2026!"}' \
  http://localhost:4000/api/v1/auth/login)

committee_token=$(LOGIN_RESPONSE="$committee_login" python -c \
  'import json, os; print(json.loads(os.environ["LOGIN_RESPONSE"])["accessToken"])')

curl --fail --silent \
  --header "authorization: Bearer $committee_token" \
  http://localhost:4000/api/v1/committee/applications \
  --output /dev/null

decision_response=$(curl --fail --silent \
  --request POST \
  --header "authorization: Bearer $committee_token" \
  --header 'content-type: application/json' \
  --data '{"decision":"APPROUVE","montantApprouve":400000000,"tauxInteret":7.5,"dureeMois":36,"differeMois":3,"commentaire":"Décision Docker de démonstration"}' \
  http://localhost:4000/api/v1/committee/applications/60000000-0000-4000-8000-000000000002/decision)

DECISION_RESPONSE="$decision_response" python -c \
  'import json, os; body=json.loads(os.environ["DECISION_RESPONSE"]); assert body["statut"] == "APPROUVE"; assert body["decisions"][0]["decision"] == "APPROUVE"'

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

direction_login=$(curl --fail --silent \
  --request POST \
  --header 'content-type: application/json' \
  --data '{"email":"direction@fodip.local","password":"FodipDemo2026!"}' \
  http://localhost:4000/api/v1/auth/login)

direction_token=$(LOGIN_RESPONSE="$direction_login" python -c \
  'import json, os; print(json.loads(os.environ["LOGIN_RESPONSE"])["accessToken"])')

dashboard_response=$(curl --fail --silent \
  --header "authorization: Bearer $direction_token" \
  http://localhost:4000/api/v1/analytics/dashboard)

DASHBOARD_RESPONSE="$dashboard_response" python -c \
  'import json, os; body=json.loads(os.environ["DASHBOARD_RESPONSE"]); assert body["kpis"]["pmeEnregistrees"] >= 4; assert body["kpis"]["montantDecaisse"] >= 400000000; assert len(body["pipeline"]) >= 3; assert len(body["regions"]) >= 4; assert body["freshness"]["source"] == "PostgreSQL analytics"'

curl --fail --silent http://localhost:3000/direction/connexion --output /dev/null

echo "Docker smoke test passed: web, API, auth, PostgreSQL analytics, scoring, committee decision and MinIO document round-trip."
