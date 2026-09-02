# FODIP Digital 2030

Plateforme numérique de gestion, de financement, de suivi et de pilotage des PME accompagnées par le FODIP en Guinée.

> Statut : MVP en développement — parcours PME, instruction Agent, scoring, Comité, cockpit Direction et cycle financier disponibles sur Docker.

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
    +--> MinIO / stockage S3 compatible
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

## Démarrage local avec Docker

Prérequis : Docker Engine avec Docker Compose v2.

```bash
docker compose up --build
```

Le démarrage crée automatiquement PostgreSQL, applique les migrations, charge un jeu de démonstration local, lance MinIO, l’API NestJS et le frontend Next.js.

| Service | Adresse |
|---|---|
| Application | http://localhost:3000 |
| API / Swagger | http://localhost:4000/api/docs |
| MinIO Console | http://localhost:9001 |
| PostgreSQL | localhost:5432 |

Comptes locaux de démonstration :

```text
Agent : agent@fodip.local
PME   : pme@fodip.local
Comité: comite@fodip.local
Direction: direction@fodip.local
Super admin: admin@fodip.local
Mot de passe commun : FodipDemo2026!
```

Ces comptes et secrets sont exclusivement destinés au poste local. Pour arrêter la plateforme :

```bash
docker compose down
```

L’ajout de `-v` supprime également les données PostgreSQL et MinIO locales.

## Documentation

- `docs/01-MVP.md` — périmètre fonctionnel du MVP
- `docs/02-DATA-MODEL.md` — modèle de données cible
- `docs/03-ARCHITECTURE.md` — architecture technique cible
- `docs/08-GESTION-DOCUMENTAIRE.md` — stockage, sécurité, intégrité et audit des documents
- `docs/09-PORTAIL-AGENT-DOCKER.md` — instruction 360° et exécution Docker autonome
- `docs/10-SCORING-COMITE.md` — scoring versionné et décision humaine auditée
- `docs/11-DATA-DASHBOARD.md` — vues analytiques PostgreSQL, définitions KPI et cockpit Direction
- `docs/12-CYCLE-FINANCIER.md` — financements, décaissements, échéances, remboursements, impact et audit
- `docs/13-NOTIFICATIONS-ADMINISTRATION.md` — notifications métier, utilisateurs, rôles et protections administratives
- `docs/14-ROADMAP-SAAS-PREMIUM.md` — feuille de route identité visuelle, conformité étatique, fiabilité SaaS
- `docs/15-DEPLOIEMENT-TEST.md` — déployer un environnement de test sur Render/Netlify avec Neon ou Supabase

## Sécurité

Ce dépôt ne doit contenir aucune clé, aucun mot de passe, aucun token, aucune donnée personnelle réelle et aucun secret d'infrastructure. Les valeurs incluses dans Docker Compose sont strictement réservées à la démonstration locale et doivent être remplacées dans tout environnement hébergé.

## Roadmap

- [x] Étape 1 — Périmètre MVP
- [x] Étape 2 — Modèle de données
- [x] Étape 3 — Architecture technique
- [x] Étape 4 — UX/UI et cockpit DG
- [x] Étape 5 — Portail PME
- [x] Étape 6 — Backend, authentification et RBAC
- [x] Étape 7 — Portail PME connecté à PostgreSQL
- [x] Étape 8 — Gestion documentaire sécurisée
- [x] Étape 9 — Portail Agent, instruction 360° et Docker
- [x] Étape 10 — Workflow, scoring et comité
- [x] Étape 11 — Data Platform et dashboards Docker/PostgreSQL
- [x] Étape 12 — Cycle financier opérationnel
- [x] Étape 13 — Notifications et administration
- [x] Étape 14a — MFA (TOTP) pour les comptes `mfa_required`
- [x] Étape 14b — dossier de déploiement (environnement de test ; la mise en production réelle reste conditionnée aux décisions B4/B5/B7/B8 de `docs/14-ROADMAP-SAAS-PREMIUM.md`)

## Licence

Logiciel propriétaire — tous droits réservés. Voir [`LICENSE`](./LICENSE).
