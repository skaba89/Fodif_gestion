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

agent_notifications=$(curl --fail --silent \
  --header "authorization: Bearer $access_token" \
  'http://localhost:4000/api/v1/notifications?unreadOnly=true')

AGENT_NOTIFICATIONS="$agent_notifications" python -c \
  'import json, os; body=json.loads(os.environ["AGENT_NOTIFICATIONS"]); assert body["unread"] >= 1; assert any(item["type"] == "DOSSIER_SOUMIS" for item in body["items"])'

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

# Axe E5 (docs/14-ROADMAP-SAAS-PREMIUM.md, intégrité financière) - maker-checker : la personne qui
# exécute un décaissement ne peut plus être celle qui l'a planifié (voir
# financings.repository.ts#executeDisbursement). direction@fodip.local planifie ci-dessous
# (« maker ») ; admin@fodip.local (SUPER_ADMIN, qui porte aussi disbursement.manage - voir
# database/007_financing_operations.sql) confirme l'exécution plus loin (« checker ») - identifiants
# de démonstration réutilisés en avance sur le bloc d'administration qui les utilise déjà ensuite.
admin_login=$(curl --fail --silent \
  --request POST \
  --header 'content-type: application/json' \
  --data '{"email":"admin@fodip.local","password":"FodipDemo2026!"}' \
  http://localhost:4000/api/v1/auth/login)

admin_token=$(LOGIN_RESPONSE="$admin_login" python -c \
  'import json, os; body=json.loads(os.environ["LOGIN_RESPONSE"]); assert "SUPER_ADMIN" in body["user"]["roles"]; print(body["accessToken"])')

eligible_response=$(curl --fail --silent \
  --header "authorization: Bearer $direction_token" \
  http://localhost:4000/api/v1/financings/eligible-applications)

ELIGIBLE_RESPONSE="$eligible_response" python -c \
  'import json, os; body=json.loads(os.environ["ELIGIBLE_RESPONSE"]); assert any(item["id"] == "60000000-0000-4000-8000-000000000002" for item in body["items"])'

current_date=$(date -u +%F)
financing_response=$(curl --fail --silent \
  --request POST \
  --header "authorization: Bearer $direction_token" \
  --header 'content-type: application/json' \
  --data "{\"dateSignature\":\"$current_date\",\"dateDebut\":\"$current_date\"}" \
  http://localhost:4000/api/v1/financings/applications/60000000-0000-4000-8000-000000000002)

financing_id=$(FINANCING_RESPONSE="$financing_response" python -c \
  'import json, os; body=json.loads(os.environ["FINANCING_RESPONSE"]); assert len(body["installments"]) == 36; print(body["id"])')

first_installment_id=$(FINANCING_RESPONSE="$financing_response" python -c \
  'import json, os; print(json.loads(os.environ["FINANCING_RESPONSE"])["installments"][0]["id"])')

planned_response=$(curl --fail --silent \
  --request POST \
  --header "authorization: Bearer $direction_token" \
  --header 'content-type: application/json' \
  --data "{\"montant\":100000000,\"datePrevue\":\"$current_date\"}" \
  "http://localhost:4000/api/v1/financings/$financing_id/disbursements")

disbursement_id=$(PLANNED_RESPONSE="$planned_response" python -c \
  'import json, os; print(json.loads(os.environ["PLANNED_RESPONSE"])["disbursements"][-1]["id"])')

curl --fail --silent \
  --request POST \
  --header "authorization: Bearer $admin_token" \
  --header 'content-type: application/json' \
  --data "{\"dateEffective\":\"$current_date\",\"referenceBancaire\":\"SMOKE-DEC-001\"}" \
  "http://localhost:4000/api/v1/financings/$financing_id/disbursements/$disbursement_id/execute" \
  --output /dev/null

curl --fail --silent \
  --request POST \
  --header "authorization: Bearer $direction_token" \
  --header 'content-type: application/json' \
  --data "{\"echeanceId\":\"$first_installment_id\",\"montant\":1000000,\"datePaiement\":\"$current_date\",\"referencePaiement\":\"SMOKE-REM-001\",\"moyenPaiement\":\"VIREMENT\"}" \
  "http://localhost:4000/api/v1/financings/$financing_id/repayments" \
  --output /dev/null

financing_detail=$(curl --fail --silent \
  --request POST \
  --header "authorization: Bearer $direction_token" \
  --header 'content-type: application/json' \
  --data "{\"periode\":\"$current_date\",\"chiffreAffaires\":3000000000,\"nombreEmployes\":25,\"emploisFemmes\":12,\"emploisHommes\":13,\"emploisJeunes\":16,\"emploisCrees\":3,\"emploisMaintenus\":22}" \
  "http://localhost:4000/api/v1/financings/$financing_id/impact")

FINANCING_DETAIL="$financing_detail" python -c \
  'import json, os; body=json.loads(os.environ["FINANCING_DETAIL"]); assert body["disbursements"][-1]["statut"] == "EFFECTUE"; assert body["installments"][0]["montantPaye"] == 1000000; assert body["installments"][0]["statut"] == "PARTIELLEMENT_PAYEE"; assert body["impact"][0]["emploisCrees"] == 3; assert len(body["audit"]) >= 5'

dashboard_response=$(curl --fail --silent \
  --header "authorization: Bearer $direction_token" \
  http://localhost:4000/api/v1/analytics/dashboard)

DASHBOARD_RESPONSE="$dashboard_response" python -c \
  'import json, os; body=json.loads(os.environ["DASHBOARD_RESPONSE"]); assert body["kpis"]["pmeEnregistrees"] >= 4; assert body["kpis"]["montantDecaisse"] >= 500000000; assert body["kpis"]["montantApprouve"] >= 950000000; assert len(body["pipeline"]) >= 3; assert len(body["regions"]) >= 4; assert body["freshness"]["source"] == "PostgreSQL analytics"'

pme_notifications=$(curl --fail --silent \
  --header "authorization: Bearer $pme_token" \
  'http://localhost:4000/api/v1/notifications?unreadOnly=true')

first_notification_id=$(PME_NOTIFICATIONS="$pme_notifications" python -c \
  'import json, os; body=json.loads(os.environ["PME_NOTIFICATIONS"]); assert body["unread"] >= 3; types={item["type"] for item in body["items"]}; assert "DOSSIER_APPROUVE" in types; assert "DECAISSEMENT_EFFECTUE" in types; assert "REMBOURSEMENT_ENREGISTRE" in types; print(body["items"][0]["id"])')

curl --fail --silent --request PATCH \
  --header "authorization: Bearer $pme_token" \
  "http://localhost:4000/api/v1/notifications/$first_notification_id/read" \
  --output /dev/null

curl --fail --silent --request PATCH \
  --header "authorization: Bearer $pme_token" \
  http://localhost:4000/api/v1/notifications/read-all \
  --output /dev/null

pme_notifications_after=$(curl --fail --silent \
  --header "authorization: Bearer $pme_token" \
  'http://localhost:4000/api/v1/notifications?unreadOnly=true')

PME_NOTIFICATIONS="$pme_notifications_after" python -c \
  'import json, os; body=json.loads(os.environ["PME_NOTIFICATIONS"]); assert body["unread"] == 0; assert body["items"] == []'

# admin_token: logged in earlier, above, to act as the maker-checker "checker" on the disbursement
# execution step.
roles_response=$(curl --fail --silent \
  --header "authorization: Bearer $admin_token" \
  http://localhost:4000/api/v1/administration/roles)

ROLES_RESPONSE="$roles_response" python -c \
  'import json, os; body=json.loads(os.environ["ROLES_RESPONSE"]); codes={item["code"] for item in body["items"]}; assert "SUPER_ADMIN" in codes; assert "PME" in codes'

created_user=$(curl --fail --silent \
  --request POST \
  --header "authorization: Bearer $admin_token" \
  --header 'content-type: application/json' \
  --data '{"email":"smoke.auditeur@fodip.local","nom":"SMOKE","prenom":"Auditeur","password":"SmokeTest2026!","roles":["AUDITEUR"]}' \
  http://localhost:4000/api/v1/administration/users)

created_user_id=$(CREATED_USER="$created_user" python -c \
  'import json, os; print(json.loads(os.environ["CREATED_USER"])["id"])')

curl --fail --silent \
  --request PATCH \
  --header "authorization: Bearer $admin_token" \
  --header 'content-type: application/json' \
  --data '{"actif":false,"roles":["AUDITEUR"]}' \
  "http://localhost:4000/api/v1/administration/users/$created_user_id" \
  --output /dev/null

users_response=$(curl --fail --silent \
  --header "authorization: Bearer $admin_token" \
  'http://localhost:4000/api/v1/administration/users?search=smoke.auditeur')

USERS_RESPONSE="$users_response" python -c \
  'import json, os; body=json.loads(os.environ["USERS_RESPONSE"]); assert body["total"] == 1; assert body["items"][0]["actif"] is False; assert body["items"][0]["roles"] == ["AUDITEUR"]'

admin_audit_count=$(docker compose exec -T postgres psql \
  --username "${POSTGRES_USER:-fodip}" --dbname "${POSTGRES_DB:-fodip}" --tuples-only --no-align \
  --command "SELECT COUNT(*) FROM audit_logs WHERE action IN ('CREATE_USER', 'UPDATE_USER')")

test "$admin_audit_count" -ge 2

curl --fail --silent http://localhost:3000/direction/connexion --output /dev/null
curl --fail --silent http://localhost:3000/direction/financements --output /dev/null
curl --fail --silent http://localhost:3000/notifications --output /dev/null
curl --fail --silent http://localhost:3000/administration/connexion --output /dev/null
curl --fail --silent http://localhost:3000/administration/utilisateurs --output /dev/null

echo "Docker smoke test passed: web, API, auth, notifications, administration, PostgreSQL analytics, financing lifecycle, scoring, committee decision and MinIO document round-trip."
