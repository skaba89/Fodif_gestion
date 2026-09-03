# Étape 22 — Mission « niveau 80-85/100 » : Lot 2 (partiel), rapport de couverture combiné

## Objectif et périmètre

Suite du Lot 1 (`docs/21-FONDATIONS-ENTREPRISE-NIVEAU-2.md`, fusionné — PR #49), sur une branche
séparée comme l'exige la mission (« jamais une PR géante » — un runtime/CI change, une évolution IAM,
une refonte UI et un changement de modèle financier ne se mélangent jamais dans une même PR). Ce lot
couvre le **premier point explicite de la section 5 (« Lot 2 ») de la mission** : un rapport de
couverture combiné (unit + intégration PostgreSQL/MinIO fusionnées en un seul rapport
texte/LCOV/HTML/synthèse GitHub) avec des seuils anti-régression initiaux.

**Explicitement hors périmètre de cette PR**, laissé pour la ou les PR suivantes de Lot 2 (chacune la
sienne, jamais mélangées ici) :

- Les cibles finales de couverture de la mission (80/80/75/75 % global, 90/90 % modules financiers/RBAC
  et isolation) — la couverture combinée mesurée ici (voir plus bas) en est loin ; les seuils posés
  dans ce lot sont un plancher anti-régression sur l'existant, pas encore ces cibles.
- Les tests d'intégration supplémentaires listés par la mission (soumission PME, affectation agent,
  transitions d'instruction, scoring, historique de statut, notifications, audit, droits sur les
  données, analytics, OIDC avec un vrai Keycloak Docker, pannes PostgreSQL/MinIO simulées, migrations
  concurrentes, rejeu HTTP, permissions manquantes, compte désactivé, token expiré, panne de
  dépendance) : chacun un ajout de test réel et vérifiable, volume trop important pour une seule PR
  sans la rendre géante — prévus en PR de suivi, une fois ce socle de reporting en place pour mesurer
  leur effet réel sur la couverture combinée.

## 5.1 — Rapport de couverture combiné (unit + intégration PostgreSQL/MinIO)

**FAIT.**

### Ce qui existait avant ce lot

- `apps/api/jest.config.cjs` : `coverageThreshold.global` sur la suite **unitaire seule**
  (65/38/45/66 %, posé au Lot 1) — ne voit jamais ce que la suite d'intégration (PostgreSQL/MinIO
  réels) couvre en plus (une ligne uniquement atteinte par un vrai conflit de contrainte unique sous
  verrouillage de ligne, par exemple, compte comme non couverte du point de vue de ce seuil alors
  qu'elle l'est réellement).
- CI (`unit-tests`) collectait déjà la couverture unitaire (`--coverage
  --coverageReporters=text-summary,json-summary,lcov`) et l'uploadait en artefact — mais **sans** le
  reporter `json` (données brutes par fichier), donc sans `coverage-final.json` exploitable pour une
  fusion.
- CI (`integration-tests`) ne collectait **aucune** couverture — `pnpm test:integration` seul, sans
  `--coverage`.

### Ce qui change

- `apps/api/jest.integration.config.js` : ajout de `collectCoverageFrom`/`coverageDirectory`
  (`coverage-integration/`, distinct du `coverage/` de la suite unitaire pour ne jamais écraser l'un
  par l'autre).
- **Nouveau `apps/api/scripts/merge-coverage.js`** : lit les deux `coverage-final.json` bruts (unit +
  intégration), les fusionne via `istanbul-lib-coverage` (`CoverageMap.merge` — une ligne/branche/
  fonction est « couverte » dans la fusion si l'un ou l'autre run l'a exécutée au moins une fois),
  écrit le rapport combiné (`text-summary`, `json-summary`, `lcov` + HTML) dans
  `apps/api/coverage-combined/`, ajoute une synthèse Markdown à `$GITHUB_STEP_SUMMARY` en CI, et
  applique un seuil anti-régression sur les nombres **combinés** (`--no-check` pour fusionner/rapporter
  sans l'appliquer). Nouvelles dépendances `istanbul-lib-coverage`/`istanbul-lib-report`/
  `istanbul-reports` en `devDependencies` d'`apps/api` — épinglées aux versions déjà résolues comme
  dépendances transitives de Jest dans le lockfile existant (3.2.2/3.0.1/3.2.0), donc aucune nouvelle
  résolution introduite, uniquement des entrées directes ajoutées (`git diff --stat pnpm-lock.yaml` :
  9 insertions, 0 suppression).
- CI (`.github/workflows/ci.yml`) :
  - `unit-tests` : ajoute le reporter `json` à sa collecte existante (aucun changement de
    comportement du job, juste une donnée brute en plus dans l'artefact déjà uploadé).
  - `integration-tests` : lance désormais `test:integration` avec `--coverage`, puis **relance la
    suite unitaire avec couverture dans ce même job** (~15 s, négligeable à côté du démarrage des
    conteneurs Testcontainers que ce job paie déjà) et exécute `merge-coverage.js`, avant d'uploader
    `apps/api/coverage-combined/` en artefact séparé (`api-coverage-combined`). Fait dans ce job
    plutôt que dans un troisième job séparé : un troisième job aurait dû télécharger les deux
    artefacts de couverture via `actions/download-artifact`, action pour laquelle ce dépôt n'a
    aujourd'hui aucun SHA épinglé vérifié (toutes les actions du workflow sont épinglées par SHA
    exact, jamais par tag — `actions/download-artifact` n'y figurait pas encore) ; réutiliser un job
    existant évite d'en introduire un sans vérification.

### Bug réel trouvé et corrigé en écrivant ce lot

`pnpm --filter @fodip/api test:integration -- --coverage ...` (la même forme
`pnpm run <script> -- <args>` qui fonctionne pour le job `unit-tests` avec son propre script `test`)
échoue silencieusement pour le script `test:integration` précisément : pnpm insère un `--` littéral
supplémentaire avant les arguments transmis, que Jest interprète alors comme « tout ce qui suit est un
motif de chemin de test », donnant `0 matches` puis `No tests found, exiting with code 1` — reproduit
localement (`pnpm --filter @fodip/api test:integration -- --listTests` échoue de la même façon, avec
ou sans `--filter`, dans `apps/api/` comme depuis la racine). Non expliqué par une différence dans le
contenu des deux scripts ; seul le nom du script change le comportement de transmission des arguments
de pnpm. Contourné en appelant Jest directement (`pnpm --filter @fodip/api exec jest --config
jest.integration.config.js --runInBand --coverage ...`), qui contourne entièrement la transmission
d'arguments de pnpm — vérifié que cette forme fonctionne (58/58 tests, `coverage-final.json` produit
au bon endroit) avant de l'utiliser dans le workflow CI.

### Vérifié réellement, pas supposé

- **8 nouveaux tests unitaires** (`apps/api/test/merge-coverage.spec.ts`) : fichier de couverture
  manquant → erreur explicite nommant le fichier et le côté de la fusion concerné ; fichier présent
  mais couvrant zéro fichier → refusé plutôt que fusionné silencieusement ; **fusion réelle prouvée**
  (deux fixtures `coverage-final.json` construites à la main, chacune ne couvrant qu'une des deux
  instructions d'un même fichier fictif — `buildCombinedMap` sur les deux ensemble donne bien 2/2, la
  preuve directe que l'union fonctionne, pas une hypothèse sur le comportement d'`istanbul-lib-coverage`) ;
  `checkThreshold` : passe silencieusement au-dessus du plancher, rapporte chaque métrique en dessous
  par son nom, gère le cas `pct: "Unknown"` (fichier à zéro instruction) sans jamais le compter comme
  un succès.
- **Chaîne CI complète simulée localement dans l'ordre exact du job** (PostgreSQL natif + `s3rver` en
  substitut MinIO, comme pour les lots précédents faute de Docker ici) : suite unitaire avec
  `--coverage --coverageReporters=json` (131/131, y compris les 8 nouveaux tests) → suite
  d'intégration avec la commande `exec jest` corrigée (58/58) → `node scripts/merge-coverage.js` →
  sortie exacte :
  ```
  Statements   : 74,57 % ( 1596/2140 )
  Branches     : 56,38 % ( 406/720 )
  Functions    : 56,1  % ( 225/401 )
  Lines        : 75,87 % ( 1359/1791 )
  ```
  seuil respecté (code de sortie 0), `$GITHUB_STEP_SUMMARY` simulé reçoit bien le tableau Markdown
  attendu.
- **Seuil vérifié dans les deux sens, pas supposé** : élevé temporairement à 99 % → échoue bien (code
  de sortie 1, message nommant `statements` et les deux pourcentages) ; restauré à la valeur réelle →
  passe de nouveau. Fichier de couverture d'intégration supprimé → erreur explicite (`does not exist`),
  pas un rapport partiel silencieux.
- Légère variation mesurée entre deux exécutions successives de la suite d'intégration seule (25,79 %
  puis 24,81 % de statements sur l'intégration isolée, 74,76 % puis 74,57 % sur le combiné) — un
  chemin de code non systématiquement emprunté d'une exécution à l'autre (vraisemblablement lié à
  l'ordre/au timing des tests de verrouillage concurrentiel). Le plancher (74/55/55/75, sous les deux
  mesures) absorbe cette variation sans masquer une vraie régression ; à surveiller si l'écart
  s'élargissait dans une PR future.
- `pnpm --filter @fodip/api test` (131/131), `pnpm --filter @fodip/api test:integration` (58/58),
  `pnpm lint`, `pnpm --filter @fodip/api build`, `pnpm --filter @fodip/web build`,
  `bash scripts/test-prepush.sh` : tous verts.

## Limitation transversale de ce lot — bac à sable sans Docker

Comme pour chaque lot précédent (`docs/20-TESTS-ENTREPRISE.md`, `docs/21-FONDATIONS-ENTREPRISE-NIVEAU-2.md`) :
ce bac à sable bloque les pulls de registre Docker, donc `docker compose build`/`up` et la matrice
Testcontainers réelle (que le job CI `integration-tests` utilise en production CI, contrairement à ce
bac à sable qui bascule sur `TEST_DATABASE_URL`/`TEST_STORAGE_ENDPOINT`) n'ont pas pu tourner ici.
Vérifié à la place : `docker compose config --quiet`, `python scripts/check-docker.py`, et la pile
locale complète décrite ci-dessus. Le job CI `integration-tests` de la PR de ce lot — qui exécute
réellement les deux suites avec couverture et la fusion, dans son propre environnement Docker/
Testcontainers — reste la vérification de référence.

## Prochaine étape recommandée

Ce socle de reporting en place, la ou les prochaines PR de Lot 2 peuvent ajouter les tests
d'intégration supplémentaires listés par la mission (section 5) un groupe cohérent à la fois (par
exemple : PME/agent/scoring d'abord, OIDC Keycloak réel ensuite — nécessite un vrai conteneur
Keycloak, non exécutable dans ce bac à sable, à vérifier par CI comme pour Docker), chacun mesurable
concrètement via `pnpm --filter @fodip/api coverage:combined` avant/après. Lot 3 (refonte UI/UX
entreprise premium) reste hors de portée tant que Lot 2 n'est pas validé, par consigne explicite de la
mission.
