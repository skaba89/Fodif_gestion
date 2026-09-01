# FODIP Digital 2030

Plateforme numérique de gestion, de financement, de suivi et de pilotage des PME accompagnées par le FODIP en Guinée.

> Statut : MVP en développement — parcours PME, instruction Agent, scoring et Comité disponibles sur Docker.

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
- [ ] Étape 11 — Data Platform et dashboards
- [ ] Étape 12 — Déploiement et dossier de présentation

## Licence

À définir avant diffusion ou exploitation institutionnelle.
