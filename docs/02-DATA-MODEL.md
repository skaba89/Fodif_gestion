# Étape 2 — Modèle de données cible

## Principe

Une PME possède une identité unique. Elle peut déposer plusieurs dossiers, recevoir plusieurs financements, plusieurs décaissements et produire des indicateurs d'impact dans le temps.

## Domaines principaux

### Référentiel PME
- `entreprises`
- `entreprise_dirigeants`
- `entreprise_contacts`
- `entreprise_etablissements`
- `entreprise_actionnaires`

### Référentiels
- `regions`
- `prefectures`
- `communes`
- `secteurs_activite`
- `programmes_fodip`

### Financement
- `dossiers_financement`
- `dossier_documents`
- `dossier_statuts_historique`
- `analyses_dossier`
- `decisions_comite`
- `financements`
- `decaissements`
- `echeances`
- `remboursements`

### Scoring
- `modeles_scoring`
- `criteres_scoring`
- `scores_dossier`
- `scores_details`

### Impact
- `suivis_impact`
- `indicateurs_impact`
- `emplois_impact`

### Sécurité
- `utilisateurs`
- `roles`
- `permissions`
- `utilisateur_roles`
- `role_permissions`

### Gouvernance
- `audit_logs`
- `notifications`

## Relations métier structurantes

```text
ENTREPRISE
   │
   ├── DIRIGEANTS
   ├── DOCUMENTS
   └── DOSSIERS_FINANCEMENT
             │
             ├── ANALYSES
             ├── SCORING
             ├── HISTORIQUE_STATUTS
             └── DECISIONS_COMITE
                       │
                       ▼
                  FINANCEMENT
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    DECAISSEMENTS   ECHEANCES   REMBOURSEMENTS
                       │
                       ▼
                  SUIVI_IMPACT
```

## Identifiants métier

En complément des UUID internes :

```text
Entreprise : FODIP-PME-000001
Dossier    : FODIP-2026-000001
```

Les UUID servent aux relations internes ; les codes métier servent aux écrans, échanges et documents officiels.

## Scoring

Le scoring doit être paramétrable et versionné. Aucun score ne doit remplacer automatiquement la décision du comité.

Catégories initiales proposées :

- administratif ;
- financier ;
- marché ;
- gouvernance ;
- capacité de remboursement ;
- impact socio-économique.

## Suivi d'impact

Les indicateurs sont historisés par période afin de mesurer notamment :

- chiffre d'affaires ;
- effectif ;
- emplois créés ;
- emplois maintenus ;
- emplois femmes ;
- emplois jeunes ;
- export ;
- production locale.

## Audit

Toute opération sensible doit générer une trace immuable fonctionnellement, avec au minimum :

- utilisateur ;
- action ;
- entité ;
- identifiant entité ;
- anciennes valeurs ;
- nouvelles valeurs ;
- adresse IP ;
- user-agent ;
- date/heure.

## Base cible

PostgreSQL est le système de référence transactionnel. Les modèles analytiques destinés au cockpit national et à l'Observatoire seront dérivés dans la Data Platform et Snowflake.
