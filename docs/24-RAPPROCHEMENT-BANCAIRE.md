# Étape 24 — Rapprochement bancaire

## Objectif

Le rapprochement bancaire vérifie qu'une opération enregistrée dans FODIP correspond à un mouvement
réel du relevé de la banque partenaire. Il complète les protections d'intégrité déjà livrées
(idempotence et maker-checker) sans modifier les montants ni les statuts financiers existants.

## Périmètre livré

- saisie d'un mouvement bancaire en GNF, identifié de façon unique par banque et référence externe ;
- file paginée des mouvements à rapprocher et historique des mouvements rapprochés ;
- suggestion des décaissements et remboursements encore disponibles ;
- rapprochement exact sur quatre critères : banque, type/sens, montant et disponibilité de
  l'opération ;
- contrôle transactionnel et contraintes PostgreSQL interdisant qu'un mouvement ou une opération
  soit rapproché deux fois, y compris sous concurrence ;
- permissions dédiées (`reconciliation.read`, `reconciliation.manage`) et journal d'audit ;
- écran Direction `/direction/rapprochements` avec filtres, synthèse et jeu de démonstration.

## Règles métier

| Mouvement du relevé | Opération FODIP attendue |
|---|---|
| Débit | Décaissement au statut `EFFECTUE` |
| Crédit | Remboursement enregistré |

Le montant doit être strictement identique et la banque du mouvement doit être la banque
correspondante du financement. Un écart reste dans la file à contrôler : il n'est jamais validé
silencieusement.

## API

- `GET /api/v1/bank-reconciliations` — synthèse, mouvements, candidats et banques ;
- `POST /api/v1/bank-reconciliations/entries` — enregistrer un mouvement bancaire ;
- `POST /api/v1/bank-reconciliations/entries/:id/match` — rapprocher une opération.

Les deux écritures acceptent `Idempotency-Key`. `ANALYSTE` et `AUDITEUR` disposent de la lecture ;
`DIRECTION_FODIP` et `SUPER_ADMIN` disposent de la lecture et de la gestion.

## Limites explicites

Ce premier lot ne prétend pas importer automatiquement les formats CSV propres à chaque banque,
ni traiter un relevé multi-devises, les frais bancaires, ou un mouvement agrégé couvrant plusieurs
opérations. Ces cas exigent une règle comptable validée avant d'autoriser un rapprochement avec
écart ou une relation plusieurs-à-plusieurs.
