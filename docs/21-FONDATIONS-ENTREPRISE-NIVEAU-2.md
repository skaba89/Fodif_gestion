# Étape 21 — Mission « niveau 80-85/100 » : fondations entreprise, Lot 1 (bloquants P0)

## Objectif et périmètre

Nouvelle mission, distincte des axes A-E de `docs/14-ROADMAP-SAAS-PREMIUM.md` (que ce lot ne
recommence pas — CODEOWNERS, template de PR, `SECURITY.md`, Dependabot, CodeQL, Gitleaks, audit des
dépendances, contrôle des licences, Trivy, SBOM, CI parallélisée, actions épinglées par SHA, tests
unitaires, 58 tests d'intégration PostgreSQL/MinIO, matrice Playwright desktop, MFA, OIDC, RBAC,
audit métier, OpenTelemetry, Prometheus/Grafana, sauvegarde/restauration, PWA — tout ça existe déjà
et fonctionne, vérifié en l'auditant, pas recréé). Objectif : faire passer FODIP Digital 2030 d'une
« plateforme fonctionnelle avancée » (≈ 65/100) vers un « SaaS entreprise critique » (80-85/100
intermédiaire, 90+ final), sans régression, un lot à la fois.

Ce document couvre le **Lot 1 — fermer les bloquants techniques P0** : protection de `main`,
standardisation Node.js, réévaluation des exceptions Trivy, migrations versionnées, et un premier
seuil anti-régression de couverture. Les lots suivants (couverture/qualité approfondie, refonte
UI/UX entreprise premium, parcours métier premium) sont explicitement hors périmètre de ce lot —
chacun sa propre PR, jamais mélangés (changement de runtime, refonte UI, évolution IAM, modèle
financier, infrastructure de production : jamais dans la même PR, par consigne explicite de la
mission).

## 4.1 — Protection réelle de `main`

**BLOQUÉ — ACTION PROPRIÉTAIRE REQUISE.** Vérifié, pas supposé : le rôle du compte authentifié sur
ce dépôt est bien `admin` (`list_repository_collaborators`), mais le serveur MCP GitHub disponible
dans cette session n'expose aucun outil de gestion des règles de protection de branche (pas
d'équivalent à l'endpoint REST « Update branch protection », contrairement aux outils PR/branches/
fichiers qu'il expose par ailleurs). Impossible de vérifier ou de configurer la protection de `main`
par API depuis cette session, indépendamment du niveau de droits réel du compte.

Étapes exactes à appliquer manuellement dans GitHub (`Settings → Branches → Add branch protection
rule`, cible `main`) :

1. **Require a pull request before merging** — coché, avec **Require approvals** (au moins 1).
2. **Require status checks to pass before merging** — coché ; sélectionner tous les jobs actuels de
   `.github/workflows/ci.yml` (`Qualité, lint et invariants pré-push`, `Tests unitaires API`, `Tests
   d'intégration API (PostgreSQL + MinIO réels)`, `Builds (API + Web)`, `Sécurité (audit, licences,
   secrets)`, `Docker Compose, Playwright et audit des images`) et `CodeQL`.
3. **Require branches to be up to date before merging** — coché.
4. **Require conversation resolution before merging** — coché.
5. **Require review from Code Owners** — coché (`.github/CODEOWNERS` existe déjà).
6. **Do not allow bypassing the above settings** — coché, y compris pour les administrateurs, si
   l'usage du dépôt le permet.
7. **Restrict who can push to matching branches** — décocher tout push direct (aucune exception).
8. **Allow force pushes** — décoché (Never).
9. **Allow deletions** — décoché.

Constaté en préparant ce lot, à corriger par ce même réglage : les PR #46 et #47 de la session
précédente ont chacune été fusionnées par un mainteneur humain **avant** que leur propre run CI
n'ait fini de s'exécuter (PR #46 fusionnée à 10:47:36Z, son job `docker` ayant échoué à 10:47:28Z ;
PR #47 fusionnée à 11:04:49Z, CI encore `in_progress` à ce moment précis) — laissant `main` rouge à
deux reprises, chaque fois corrigé par une PR de suivi immédiate. Un statut CI obligatoire
(point 2 ci-dessus) aurait rendu ces deux fusions prématurées impossibles au niveau de GitHub
lui-même, plutôt que de dépendre d'une correction après coup.

## 4.2 — Standardisation Node.js 24 LTS

**FAIT.** Avant ce lot : CI sur Node 22, les deux `Dockerfile` sur `node:26-bookworm-slim` (un
changement livré par une PR Dependabot indépendante, jamais réaligné avec la CI), `netlify.toml` sur
Node 22, aucun `.nvmrc`, aucun champ `engines`. Trois versions différentes en vigueur simultanément
sur le même dépôt, sans qu'aucun contrôle ne le détecte.

Aligné sur **Node.js 24 LTS** (« Krypton », LTS active depuis octobre 2025) partout :
`.github/workflows/ci.yml` (`env.NODE_VERSION`), les deux `Dockerfile` (chaque stage `FROM
node:24-bookworm-slim`), `netlify.toml`, nouveau `.nvmrc`, et `package.json` (`"engines": {"node":
">=24 <25", "pnpm": "9.15.0"}`).

Nouveau `scripts/check-node-version.py`, ajouté à `pnpm test:prepush` (donc au job CI `invariants`,
qui échoue désormais si l'une de ces cinq sources diverge) : parse `.nvmrc`, `package.json.engines
.node`, chaque stage `FROM node:X` des deux `Dockerfile`, `ci.yml` et `netlify.toml`, et échoue si
la version majeure Node diffère d'une seule d'entre elles. Vérifié qu'il détecte une vraie
régression, pas seulement une régression injectée pour la forme : `NODE_VERSION` de `ci.yml`
temporairement remis à 22, le script échoue en nommant précisément la source en désaccord ; fichier
restauré à l'identique ensuite (`git diff` vide).

Corepack : toujours distribué en « expérimental » sur la ligne 24.x (retiré seulement à partir de la
25 — [nodejs/corepack#722](https://github.com/nodejs/corepack/issues/722)), donc sans impact réel
ici — les deux `Dockerfile` installent déjà pnpm via `npm install -g` plutôt que Corepack depuis le
correctif du passage à `node:26`, un choix qui survit indifféremment au passage à Node 24.

**Limite honnête** : ce bac à sable de développement n'a que Node 20/21/22 préinstallés (pas
d'accès réseau vers nodejs.org pour en installer un autre) — l'exécution réelle sous Node 24 n'a pas
pu être vérifiée ici. `actions/setup-node` avec `node-version: 24` dans le job CI `invariants` en
est la vérification de référence, comme pour toute limitation de ce bac à sable déjà rencontrée et
documentée dans `docs/20-TESTS-ENTREPRISE.md`.

## 4.3 — Vulnérabilités des images (`.trivyignore`)

**PARTIEL, assumé comme tel.** Dérive réelle trouvée en auditant ce fichier pour ce lot : son
en-tête référençait encore `node:22-bookworm-slim`, alors que les deux `Dockerfile` étaient déjà sur
`node:26-bookworm-slim` depuis plusieurs PR — jamais re-revu au moment de ce changement de base. Ce
lot corrige la dérive (en-tête mis à jour) et ajoute, par CVE, les champs de gouvernance demandés
par la mission : sévérité, responsable, date d'acceptation, date d'expiration, ticket de suivi,
solution cible (voir `.trivyignore` directement — le fichier porte lui-même le détail complet plutôt
que de le dupliquer ici).

Identifié une piste concrète pour **éliminer** 8 des 14 CVE plutôt que les accepter indéfiniment :
retirer `perl` du stage `runtime` des deux `Dockerfile`, sur le même principe déjà appliqué à
`npm`/`npx`/`corepack` (aucune des deux applications n'invoque jamais perl). **Proposé, pas fait à
l'aveugle** : ce bac à sable ne peut pas construire ni lancer une image Docker réelle pour vérifier
qu'un tel retrait ne casse rien (même limitation réseau que pour PostgreSQL/MinIO, voir
`docs/20-TESTS-ENTREPRISE.md`) — un changement de cette nature, non vérifiable ici, est laissé en
suivi séparé plutôt que risqué sans preuve.

**Non fait dans ce lot** : le re-scan Trivy réel des 14 exceptions contre le nouveau
`node:24-bookworm-slim`, et l'essai d'une image alternative (distroless ou autre minimale — item
4.3 de la mission). Les deux nécessitent un environnement Docker fonctionnel, absent ici. Le second
point est de toute façon un changement de famille d'image à part entière — la mission elle-même
interdit de le mélanger avec un lot de fondations (section 3, « Ne pas mélanger... changement de
runtime ») ; `docs/19-GOUVERNANCE-SUPPLY-CHAIN.md` l'avait déjà identifié comme un axe séparé (E7)
lors de la décision initiale sur ces 14 CVE. Le job CI `docker` (étape Trivy) de la PR de ce lot est
la vérification de référence pour la reconfirmation réelle des 14 exceptions.

## 4.4 — Migrations versionnées et sommées

**FAIT.** `apps/api/scripts/run-migrations.js` réécrit : une table `schema_migrations` (`version`,
`filename`, `checksum`, `applied_at`, `execution_time_ms`, `success`) remplace le simple rejeu de
tous les fichiers à chaque exécution.

- **Seules les migrations non appliquées s'exécutent** — un fichier déjà tracké avec le même hash
  SHA-256 est explicitement ignoré (« Skipping ... already applied »), pas simplement rejoué dans
  l'espoir que ses gardes `IF NOT EXISTS`/`ON CONFLICT` suffisent.
- **Une migration déjà appliquée puis modifiée est détectée et refusée** : le hash recalculé à
  chaque exécution est comparé au hash enregistré ; en cas d'écart, erreur explicite nommant le
  fichier et les deux hash, exécution arrêtée avant toute autre migration.
- **Verrou consultatif PostgreSQL** (`pg_try_advisory_lock`, non bloquant) empêche deux exécutions
  concurrentes de la même base : la seconde échoue immédiatement avec un message explicite plutôt
  que d'entrelacer ses DDL avec la première.
- **Chaque fichier s'exécute dans sa propre transaction** (`BEGIN`/`COMMIT`, `ROLLBACK` sur erreur)
  — un échec à mi-fichier n'y laisse aucun DDL partiel, et l'exécution s'arrête immédiatement (pas
  de fichier suivant tenté).
- **Les seeds ne sont jamais lancés en production** : `--seed` avec `NODE_ENV=production` est
  désormais refusé d'emblée. `docs/15-DEPLOIEMENT-TEST.md` documente le contournement explicite
  nécessaire pour l'environnement de démonstration privé qu'il décrivait déjà (Render définit
  `NODE_ENV=production` par défaut).

`docker-compose.yml` : le service `migrations` construit désormais depuis l'image `api` (déjà
présente dans son étage `runtime` : `scripts/run-migrations.js` et `database/`) et lance
`node scripts/run-migrations.js`, au lieu d'une boucle `psql` brute sur une image PostgreSQL séparée
— le mécanisme versionné devient le chemin réel utilisé par `docker compose up`, pas seulement celui
documenté pour un déploiement hébergé isolé. Le service `seed` reste volontairement inchangé (boucle
`psql` brute, toujours inconditionnelle sur un `docker compose up` par défaut) : le gater derrière un
profil Compose casserait par défaut les comptes de démonstration dont dépend la matrice Playwright
CI juste stabilisée (PR #45-#48) — changement jugé trop risqué à coupler à ce lot sans pouvoir
vérifier `docker compose up` réellement dans ce bac à sable ; noté comme suivi séparé.

### Vérifié réellement, pas supposé

- **13 tests unitaires** (`apps/api/test/run-migrations.spec.ts`, client PostgreSQL simulé) sur le
  contrôle de flux : application dans l'ordre, saut d'une migration déjà appliquée, détection d'un
  hash modifié, rollback + enregistrement d'échec, refus si le verrou est déjà tenu.
- **6 tests d'intégration réels** (`apps/api/test/integration/run-migrations.integration-spec.ts`,
  vrai PostgreSQL, schéma repartant de zéro à chaque cas via `DROP SCHEMA public CASCADE`) — preuve
  de ce qu'un client simulé ne peut structurellement pas démontrer :
  - application des 13 vrais fichiers `database/*.sql` depuis zéro, hash enregistré vérifié égal au
    hash réel de chaque fichier ;
  - un second passage est un vrai no-op (aucune ré-exécution, tous les fichiers « skipped ») ;
  - **chemin de mise à niveau N-1** : base déjà migrée jusqu'à N-1, seule la migration N
    nouvellement ajoutée s'exécute au passage suivant ;
  - un fichier édité après application est refusé (écart de somme de contrôle) ;
  - **rollback transactionnel réel** : un fichier à deux instructions dont la seconde est invalide
    ne laisse la table créée par la première nulle part (`to_regclass` la trouve `NULL` après coup)
    — preuve directe, pas une hypothèse sur le comportement de `ROLLBACK` ;
  - **verrou consultatif réel entre deux connexions PostgreSQL concurrentes** : deux appels
    `applyMigrations` simultanés sur la même base, un seul aboutit, l'autre échoue avec le message
    exact attendu, une seule ligne `success = TRUE` en base au final.
- Vérification de bout en bout supplémentaire, au-delà de la seule suite de tests : base `fodip_dev`
  entièrement recréée puis migrée + seedée via `node apps/api/scripts/run-migrations.js --seed`
  (le même chemin qu'un vrai déploiement), API compilée et lancée dessus, web `next start` par
  dessus, et **les 17 tests e2e Playwright (`chromium`) exécutés contre cette pile passent
  intégralement** — la base produite par le nouveau mécanisme est fonctionnellement identique à
  celle produite par l'ancien rejeu brut.
- `pnpm --filter @fodip/api test` (120/120, suite unitaire complète), `pnpm --filter @fodip/api
  test:integration` (58/58, y compris les 6 nouveaux), `pnpm lint`, `npx tsc --noEmit`,
  `docker compose config --quiet`, `python scripts/check-docker.py` : tous verts.

## 5.1 (partiel) — Seuil anti-régression de couverture

**FAIT, scope limité à ce que demande explicitement ce lot** (point 7 de la section « Première
livraison » de la mission — le rapport combiné unit+intégration+MinIO avec cibles 80/80/75/75/90/90
est le Lot 2, une PR séparée, pas fait ici pour ne pas prétendre à une couverture non atteinte).

`apps/api/jest.config.cjs` : `coverageThreshold.global` verrouillé sur la couverture actuellement
mesurée (statements 65,51 % / branches 38,75 % / functions 45,63 % / lines 66,55 %), avec un plancher
légèrement en dessous (65/38/45/66) pour absorber le bruit incident sans masquer une vraie
régression. Vérifié que le seuil détecte une vraie régression, pas supposé : un fichier de test réel
(`administration.repository.spec.ts`) temporairement retiré, `jest --coverage` échoue bien (code de
sortie 1, message « threshold not met » sur les quatre métriques) ; fichier restauré à l'identique
ensuite (`git status` propre).

## Limitation transversale de ce lot — bac à sable sans Docker

Comme pour chaque lot précédent qui en dépendait (`docs/20-TESTS-ENTREPRISE.md`), ce bac à sable de
développement bloque les pulls de registre Docker (Docker Hub, GHCR) : `docker compose build`,
`docker compose up`, `scripts/docker-smoke.sh` et `scripts/test-backup-restore.sh` n'ont pas pu être
exécutés réellement ici. Vérifié à la place : `docker compose config --quiet` (syntaxe/sémantique du
fichier), `python scripts/check-docker.py` (invariants de topologie), `bash -n` sur les scripts
concernés, et — pour tout ce qui touche réellement PostgreSQL — une pile locale complète montée sans
Docker (PostgreSQL natif, `s3rver` en substitut MinIO, API compilée, `next start`), le même
contournement déjà établi et documenté pour les lots précédents. Le job CI `docker` de la PR de ce
lot reste la vérification de référence pour tout ce qui dépend réellement de Docker.

## Prochaine étape recommandée

Lot 1 (bloquants techniques P0) complet dans la mesure de ce qui est vérifiable dans ce bac à sable ;
protection de `main` bloquée en attente d'une action du propriétaire (voir 4.1). Suite logique,
chacune sa propre PR : Lot 2 (rapport de couverture combiné + tests d'intégration supplémentaires —
PME/agent/scoring/OIDC Keycloak réel/pannes simulées), puis seulement après validation de ces deux
lots, Lot 3 (refonte UI/UX entreprise premium, shell applicatif partagé, navigation mobile — le
correctif de la disparition de la navigation sous 680-900px déjà identifié comme tâche de suivi
distincte lors de la matrice Playwright, PR #46).
