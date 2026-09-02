# Étape 14c — Sauvegardes PostgreSQL et restauration (axe C6)

## Objectif et périmètre

Axe **C6** de `docs/14-ROADMAP-SAAS-PREMIUM.md` : « Sauvegardes PostgreSQL automatisées et
testées (restauration), plan de reprise après sinistre ».

C6 recouvre deux choses distinctes :

- le **mécanisme** de sauvegarde et de restauration, et la preuve qu'une sauvegarde se restaure
  réellement — ce que ce document et les scripts qu'il décrit couvrent ;
- la **planification en production** (fréquence, réplication hors site, durée de rétention,
  objectifs RPO/RTO formels) — qui n'a de sens qu'une fois l'hébergement choisi
  (`docs/14-ROADMAP-SAAS-PREMIUM.md`, axe B7b) : un service PostgreSQL géré (Neon, Supabase, RDS,
  ...) a en général ses propres sauvegardes automatiques intégrées, qu'il vaut mieux réutiliser
  plutôt que dupliquer ; un PostgreSQL auto-hébergé n'a pas ce filet et a besoin exactement du
  mécanisme ci-dessous, planifié par le mécanisme de tâches planifiées de la plateforme cible
  (cron systemd, tâche planifiée Kubernetes, ...). Cette seconde moitié reste donc ouverte, comme
  documenté dans `docs/15-DEPLOIEMENT-TEST.md`.

## Le mécanisme

Trois scripts, tous exécutés à travers le conteneur `postgres:16.10-alpine` de
`docker-compose.yml` (mêmes outils client que le serveur — exactement le principe déjà appliqué
par les conteneurs `migrations`/`seed`, qui n'installent pas non plus `psql` sur l'hôte) :

- **`scripts/backup-postgres.sh [répertoire-de-sortie]`** — sauvegarde la base en cours
  d'exécution au format compressé `pg_dump --format=custom` (restauration sélective possible,
  plus compact qu'un `.sql` en clair) dans un fichier horodaté (`backups/fodip-<horodatage>.dump`
  par défaut).
- **`scripts/restore-postgres.sh <fichier-dump> [--target-db NOM] [--force]`** — restaure une
  sauvegarde. Par défaut, la cible est la base réelle (`POSTGRES_DB`) : le script refuse de
  s'exécuter sans `--force`, pour ne pas écraser des données réelles par erreur. `--target-db`
  restaure dans une autre base (typiquement une base « scratch » jetable) pour vérifier une
  sauvegarde sans toucher à la base réelle.
- **`scripts/test-backup-restore.sh`** — la preuve que la restauration fonctionne, pas seulement
  que la sauvegarde s'exécute : sauvegarde la base réelle, restaure la sauvegarde dans une base
  jetable (`fodip_restore_test`), puis compare le nombre de lignes de chaque table entre
  l'originale et la copie restaurée. Échoue si un seul écart apparaît. Exécuté automatiquement à
  chaque exécution de la CI (`.github/workflows/ci.yml`, juste après le test de fumée Docker
  existant) contre une vraie instance PostgreSQL — une régression réelle du mécanisme de
  sauvegarde/restauration casse la CI, elle ne resterait pas silencieuse jusqu'à une tentative de
  reprise après sinistre réelle.

## Utilisation manuelle

```bash
docker compose up --detach   # la pile doit tourner

# Sauvegarder
bash scripts/backup-postgres.sh
# → backups/fodip-20260902T140000Z.dump

# Vérifier qu'une sauvegarde se restaure (sans toucher à la base réelle)
bash scripts/restore-postgres.sh backups/fodip-20260902T140000Z.dump --target-db fodip_verif --force

# Restauration réelle (reprise après sinistre - écrase la base en cours) :
bash scripts/restore-postgres.sh backups/fodip-20260902T140000Z.dump --force
```

## Reste ouvert (dépend de l'axe B7b)

- **Planification automatique** : ces scripts ne s'exécutent pas seuls sur un calendrier — à
  brancher sur le mécanisme de tâches planifiées de l'hébergeur retenu.
- **Réplication hors site / rétention** : les sauvegardes créées par `backup-postgres.sh`
  restent sur la machine qui les a produites ; une politique de rétention (combien de sauvegardes
  garder, pendant combien de temps) et une réplication vers un stockage durable distinct de la
  base elle-même (S3/R2, un autre datacenter, ...) sont à définir avec l'hébergement cible.
- **Objectifs RPO/RTO formels** : à documenter une fois la fréquence de sauvegarde et le temps de
  restauration réel sur l'infrastructure cible connus.
