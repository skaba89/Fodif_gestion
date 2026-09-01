# FODIP Digital 2030

Plateforme numérique de gestion, de financement, de suivi et de pilotage des PME accompagnées par le FODIP en Guinée.

> Statut : cadrage et socle d'architecture — MVP en préparation.

## Vision

FODIP Digital 2030 vise à fournir une infrastructure numérique unifiée couvrant le cycle de vie complet d'une PME accompagnée :

- référentiel unique des entreprises ;
- dépôt et instruction des dossiers de financement ;
- gestion documentaire ;
- scoring d'aide à la décision ;
- décisions de comité ;
- financements et décaissements ;
- échéanciers et remboursements ;
- suivi de l'impact économique et social ;
- cockpit de pilotage pour la Direction ;
- socle Data Platform pour l'Observatoire des PME.

## Architecture cible

```text
Utilisateurs
    |
    v
Next.js / PWA
    |
    v
API Gateway
    |
    v
NestJS
    |
    +--> PostgreSQL
    +--> Azure Blob Storage
    +--> Redis
    +--> Event Bus
    |
    v
Data Platform
    |
    v
Snowflake
    |
    +--> Cockpit Direction
    +--> Observatoire
```

## Principes d'architecture

- monolithe modulaire pour le MVP ;
- PostgreSQL comme système transactionnel de référence ;
- stockage documentaire hors base ;
- RBAC et MFA pour les profils sensibles ;
- journal d'audit pour les opérations critiques ;
- séparation stricte DEV / REC / PPD / PROD ;
- approche mobile-first et PWA ;
- Data Platform séparée du transactionnel ;
- aucun secret dans le dépôt Git.

## Modules métier prévus

1. Référentiel PME
2. Utilisateurs, rôles et permissions
3. Programmes FODIP
4. Dossiers de financement
5. Documents
6. Workflow d'instruction
7. Analyse et scoring
8. Comité et décisions
9. Financements
10. Décaissements
11. Échéanciers et remboursements
12. Suivi d'impact
13. Notifications
14. Audit
15. Cockpit de pilotage
16. Observatoire des PME

## Structure du dépôt

```text
Fodif_gestion/
├── apps/
│   ├── web/                 # Frontend Next.js / PWA
│   └── api/                 # Backend NestJS
├── database/                # Modèle transactionnel et migrations
├── docs/                    # Cadrage fonctionnel et architecture
├── infra/                   # Infrastructure et déploiement
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Documentation

- `docs/01-MVP.md` — périmètre fonctionnel du MVP
- `docs/02-DATA-MODEL.md` — modèle de données cible
- `docs/03-ARCHITECTURE.md` — architecture technique cible

## Sécurité

Ce dépôt ne doit contenir aucune clé, aucun mot de passe, aucun token, aucune donnée personnelle réelle et aucun secret d'infrastructure. Les secrets seront externalisés via un gestionnaire de secrets tel qu'Azure Key Vault.

## Roadmap

- [x] Étape 1 — Périmètre MVP
- [x] Étape 2 — Modèle de données
- [x] Étape 3 — Architecture technique
- [ ] Étape 4 — UX/UI
- [ ] Étape 5 — Backend/API
- [ ] Étape 6 — Frontend
- [ ] Étape 7 — Data Platform & dashboards
- [ ] Étape 8 — Sécurité et audit
- [ ] Étape 9 — Tests et CI/CD
- [ ] Étape 10 — Déploiement et dossier de présentation

## Licence

À définir avant diffusion ou exploitation institutionnelle.
