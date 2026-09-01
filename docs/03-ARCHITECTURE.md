# Étape 3 — Architecture technique cible

## Architecture générale

```text
Utilisateurs
    │
    ▼
Next.js / PWA
    │
    ▼
API Gateway / WAF
    │
    ▼
NestJS
    │
    ├── PostgreSQL
    ├── MinIO / stockage S3 compatible
    ├── Redis
    └── Event Bus
          │
          ▼
     Traitements async

PostgreSQL
    │
    ▼
Data ingestion
    │
    ▼
Snowflake
    │
    ├── BRONZE
    ├── SILVER
    └── GOLD
          │
          ├── Cockpit Direction
          └── Observatoire
```

## Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS
- design system dédié
- PWA
- responsive et mobile-first

Le portail doit couvrir les espaces :

- entrepreneur ;
- agent ;
- comité ;
- Direction ;
- partenaire ;
- auditeur ;
- observatoire.

## Backend

- NestJS
- TypeScript
- REST API
- OpenAPI
- monolithe modulaire pour le MVP

Modules cibles :

```text
auth
users
companies
directors
applications
documents
scoring
committees
financing
disbursements
repayments
impact
programs
notifications
audit
reporting
administration
```

## Base transactionnelle

PostgreSQL est le System of Record pour les opérations métier.

Il ne doit pas servir de moteur principal pour les analyses nationales lourdes.

## Data Platform

Architecture analytique cible :

```text
RAW
 ↓
BRONZE
 ↓
SILVER
 ↓
GOLD
```

Modèle GOLD initial :

### Dimensions
- `DIM_ENTREPRISE`
- `DIM_TEMPS`
- `DIM_GEOGRAPHIE`
- `DIM_SECTEUR`
- `DIM_PROGRAMME`
- `DIM_BANQUE`

### Faits
- `FACT_DOSSIER`
- `FACT_FINANCEMENT`
- `FACT_DECAISSEMENT`
- `FACT_REMBOURSEMENT`
- `FACT_EMPLOI`
- `FACT_IMPACT`

## Documents

Les fichiers sont stockés hors PostgreSQL dans un stockage objet S3 compatible. Le déploiement Docker actuel utilise MinIO.

PostgreSQL ne conserve que :

- nom logique ;
- type ;
- chemin/clé de stockage ;
- taille ;
- MIME type ;
- checksum ;
- statut de vérification ;
- métadonnées d'audit.

## Sécurité

- RBAC fin ;
- MFA pour les comptes sensibles ;
- chiffrement en transit et au repos ;
- secrets externalisés ;
- gestionnaire de secrets externe à choisir avant hébergement ;
- aucune clé dans le dépôt ;
- audit des opérations critiques ;
- rate limiting et protections API ;
- séparation stricte des environnements.

## Intégration partenaires

Les partenaires bancaires n'accèdent jamais directement aux bases.

```text
FODIP Core
    │
    ▼
Partner API
    │
    ├── Banque A
    ├── Banque B
    └── Autres partenaires
```

Les intégrations devront être authentifiées, scopées, journalisées et versionnées.

## Événements et traitements asynchrones

Exemple :

```text
APPLICATION_APPROVED
   ├── notification email
   ├── notification SMS
   ├── audit
   └── synchronisation data
```

RabbitMQ, NATS ou une solution équivalente pourra assurer le transport des événements.

## Environnements

```text
DEV
REC
PPD
PROD
```

Chaque environnement possède ses propres :

- bases ;
- comptes de stockage ;
- secrets ;
- configurations ;
- ressources applicatives.

Aucune donnée personnelle de production ne doit être recopiée en clair dans les environnements non-production.

## CI/CD cible

```text
Feature branch
   ↓
Pull Request
   ├── lint
   ├── tests unitaires
   ├── tests d'intégration
   ├── scan sécurité
   ├── build
   └── validation migrations
   ↓
DEV
   ↓
REC
   ↓
PPD
   ↓
PROD
```

## Haute disponibilité et reprise

Prévoir pour la production :

- applications stateless et réplicables ;
- PostgreSQL managé avec sauvegardes et point-in-time recovery ;
- versioning/soft delete sur le stockage documentaire ;
- procédures de restauration testées ;
- métriques, traces et logs centralisés.

## Stratégie de livraison

### MVP 1
- Next.js / PWA
- NestJS
- PostgreSQL
- stockage documentaire
- authentification
- RBAC
- PME
- dossiers
- documents
- workflow
- scoring
- comité
- financement
- décaissement
- suivi
- audit
- dashboard basique

### MVP 2
- remboursements avancés
- notifications multicanales
- banques partenaires
- scoring enrichi
- suivi d'impact
- Data Platform

### Phase nationale
- Snowflake avancé
- Observatoire national
- API partenaires
- BI avancée
- cartographie
- prévisions
- open data
- IA et détection de risque
- interopérabilité gouvernementale
