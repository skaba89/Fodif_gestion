# Étape 9 — Portail Agent et plateforme Docker

## Résultat

FODIP Digital peut désormais fonctionner localement sans service Azure :

```text
Navigateur
   ↓
Next.js
   ↓
NestJS
   ├── PostgreSQL
   └── MinIO (API S3)
```

`docker compose up --build` démarre les six services nécessaires : `postgres`, `migrations`, `seed`, `minio`, `api` et `web`.

## Portail Agent

Routes principales :

- `/agent/connexion`
- `/agent/dossiers`
- `/agent/dossiers/:id`

La liste permet de filtrer les dossiers par statut ou par recherche textuelle. La fiche 360° consolide :

- identité et coordonnées de la PME ;
- programme et demande de financement ;
- dirigeant principal ;
- documents et statut de vérification ;
- historique du workflow ;
- scoring disponible ;
- agent responsable.

## Workflow d’instruction

Transitions autorisées :

```text
SOUMIS
  ├── EN_INSTRUCTION
  └── COMPLEMENT_REQUIS

EN_INSTRUCTION
  ├── COMPLEMENT_REQUIS
  └── PRET_COMITE

COMPLEMENT_REQUIS
  └── EN_INSTRUCTION
```

Un agent doit prendre en charge le dossier avant de modifier son statut. Une transition concurrente ou réalisée par un autre agent est refusée. Chaque décision écrit simultanément l’historique et le journal d’audit.

## Stockage documentaire

MinIO fournit le stockage objet local. Le bucket est privé et créé automatiquement par l’API. Le navigateur ne reçoit jamais les identifiants MinIO ni une URL publique.

Le code utilise le protocole S3 compatible afin de conserver une séparation nette entre logique métier et fournisseur de stockage.

## Données de démonstration

Le seed Docker crée une PME, un programme, deux dossiers et deux utilisateurs locaux. Il est isolé dans `database/seeds` et n’est pas exécuté par les migrations standard hors Docker Compose.

Le mot de passe de démonstration est public par conception et ne doit jamais être réutilisé dans un environnement hébergé.

## Contrôles

Avant chaque push :

- politiques de transition Agent ;
- politiques PME et documents ;
- contrôle des migrations additives ;
- validation statique de la topologie Docker ;
- ESLint API/web ;
- tests Jest ;
- builds NestJS et Next.js.

GitHub Actions exécute en plus :

- `docker compose config` ;
- `docker compose build api web`.

Le moteur Docker n’étant pas disponible dans l’environnement local Codex actuel, la construction réelle des images est obligatoirement validée par la CI avant fusion.
