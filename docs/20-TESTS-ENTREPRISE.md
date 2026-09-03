# Étape 16 — Sprint Enterprise 0, Lot 2 (partiel) : tests entreprise, module `financings`

## Objectif et périmètre

Axe E2 de `docs/14-ROADMAP-SAAS-PREMIUM.md`. Cette itération couvre un seul module — `financings`
(financements, décaissements, remboursements, échéances), le plus critique financièrement — contre
un vrai PostgreSQL, pas des mocks. Elle ne couvre pas encore : MinIO, les autres modules critiques
(administration, comité, partenaires bancaires, scoring, isolation PME), la matrice Playwright
multi-navigateurs/mobile, ni la régression visuelle — tout cela reste à faire dans des lots
suivants, volontairement séparés (jamais une PR géante).

## Pourquoi les tests existants ne suffisaient pas

`apps/api/test/financings.service.spec.ts` (et les 19 autres `test/*.spec.ts`) exercent les
services contre des repositories entièrement mockés (`jest.fn()`). Utile pour la logique de
branchement du service, mais structurellement incapable de vérifier ce qui dépend du comportement
réel de PostgreSQL : le verrouillage de lignes (`FOR UPDATE`), les conflits de contrainte unique,
ou deux requêtes qui s'exécutent véritablement en parallèle. Avant cette itération,
`financings.repository.ts` — la classe qui contient toute la logique SQL de verrouillage — n'avait
que **7,84 % de couverture de lignes** (`coverage-summary.json`, mesuré avant modification) : les
mocks ne l'atteignent jamais, seuls les chemins déjà exercés indirectement par-dessus les mocks du
service comptent.

Les scénarios explicitement demandés — double-clic / double-soumission, requêtes concurrentes,
dépassement du montant accordé, trop-perçu au-delà du montant dû, transitions de statut interdites,
rollback transactionnel — ne sont vérifiables qu'avec un vrai moteur SQL.

## Ce qui a été fait

### Infrastructure de test (`apps/api/test/integration/support/`)

- **`database.ts`** : démarre un conteneur `postgres:16.10-alpine` jetable via
  [Testcontainers](https://testcontainers.com/) (`testcontainers` + `@testcontainers/postgresql`,
  épinglés à `12.1.0`) — exactement l'image que `docker-compose.yml` épingle pour le service
  `postgres`. Applique les vraies migrations `database/*.sql` dessus, puis construit un vrai
  `DatabaseService` (la classe de production, pas une doublure) branché dessus via `ConfigService`.
  Expose `reset()` (TRUNCATE CASCADE de toutes les tables entre deux tests, rapide) et `stop()`.
  Un seul conteneur par fichier de test (`beforeAll`), pas par cas de test : le démarrage prend
  plusieurs secondes, `reset()` entre chaque test est presque instantané.
- **`fixtures.ts`** : générateurs de données minimales (entreprise + dossier + décision de comité
  APPROUVE, utilisateur) avec identifiants uniques par appel pour ne jamais entrer en collision
  entre tests.
- **`jest.integration.config.js`** : configuration Jest séparée (`testRegex:
  '.*\.integration-spec\.ts$'`), **volontairement exclue** de `jest.config.js` (qui ne matche que
  `*.spec.ts` / `*.e2e-spec.ts`) — ces specs ont besoin d'un démon Docker et prennent plusieurs
  secondes par fichier ; elles ne doivent jamais ralentir ni faire échouer `pnpm test` sur une
  machine sans Docker qui tourne.
- Nouveau script `pnpm --filter @fodip/api test:integration`.

### Échappatoire `TEST_DATABASE_URL` (pourquoi, voir plus bas)

`database.ts` accepte une variable d'environnement `TEST_DATABASE_URL` : si elle est définie, le
harnais se connecte directement à cette base au lieu de démarrer un conteneur (mais applique quand
même les migrations et fournit `reset()`/`stop()` normalement). **Non définie en CI** — la CI
utilise le chemin normal, hermétique, via Testcontainers. Cette échappatoire a servi à la
vérification locale (voir « Limitation constatée » plus bas) et reste utile pour tout
environnement où Testcontainers ne peut pas atteindre un registre d'images mais où un vrai
PostgreSQL jetable est disponible autrement.

### Specs (`apps/api/test/integration/financings.integration-spec.ts`, 12 tests)

| Scénario demandé dans la mission | Test |
|---|---|
| Cas nominal | Création d'un financement depuis un dossier éligible : échéancier complet généré, capital total = montant accordé, entrée d'audit `CREATE_FINANCING` |
| Transition de statut interdite | Dossier non `APPROUVE` → `ConflictException` ; financement non `ACTIF` → décaissement refusé ; décaissement déjà `EFFECTUE` → ré-exécution refusée |
| Double-clic / double-soumission | Deux créations de financement concurrentes pour le même dossier → une seule réussit (contrainte `uq_financements_dossier`, pas seulement la logique applicative) ; deux exécutions concurrentes du même décaissement `PREVU` → une seule réussit |
| Dépassement du montant accordé | Décaissement seul au-dessus du solde → `BadRequestException` |
| Requêtes concurrentes dépassant le montant accordé | Deux décaissements qui tiennent chacun individuellement mais dépassent ensemble le montant accordé → une seule requête réussit (verrou `FOR UPDATE`), le total engagé ne dépasse jamais le montant accordé |
| Trop-perçu au-delà du montant dû | Remboursement seul au-dessus du reste dû → `BadRequestException` ; deux remboursements concurrents qui, ensemble, dépasseraient le montant dû → un seul réussit, le total payé ne dépasse jamais le montant dû |
| Statuts d'échéance | `PARTIELLEMENT_PAYEE` après un paiement partiel, `PAYEE` seulement une fois soldée |
| Rollback transactionnel | Un échec au milieu de la transaction de création (date invalide dans l'échéancier) ne laisse aucun financement ni aucune échéance orpheline |

## Vérifié

Chaque affirmation ci-dessous a été vérifiée réellement, pas supposée :

- **Les 12 tests passent** contre un vrai PostgreSQL, exécutés 4 fois de suite sans un seul échec
  intermittent (les tests de concurrence sont exactement le genre de test qui peut être flaky s'il
  est mal conçu — vérifié qu'il ne l'est pas, pas juste espéré).
- **Ces tests détectent une vraie régression, pas seulement une régression injectée pour la forme** :
  le verrou `FOR UPDATE` de `planDisbursement` a été retiré temporairement, le test de concurrence
  correspondant a échoué immédiatement (conflit de contrainte SQL au lieu du `ConflictException`
  applicatif attendu), puis le fichier a été restauré à l'identique (`git diff` vide après
  restauration) et la suite complète re-passée au vert.
- `pnpm --filter @fodip/api lint` : aucune erreur sur les nouveaux fichiers.
- `pnpm --filter @fodip/api test` (suite unitaire existante, 112 tests, 23 fichiers) : toujours au
  vert, aucune régression. Couverture globale inchangée (65,51 % lignes) — attendu, les tests
  d'intégration tournent dans une configuration Jest séparée, non incluse dans cette mesure.
- `npx tsc --noEmit` sur `apps/api` (le `tsconfig.json` du projet inclut déjà `test/**/*`) : aucune
  erreur.
- `.github/workflows/ci.yml` validé avec `actionlint` : aucun avertissement.

### Couverture apportée par les tests d'intégration (module `financings` seul)

Mesuré séparément (`--collectCoverageFrom="src/financings/**/*.ts"` sur la nouvelle config Jest
seule, sans fusionner avec la suite unitaire) :

| | Avant (unitaire seul, mocks) | Apporté par les tests d'intégration |
|---|---|---|
| `financings.repository.ts` (lignes) | 7,84 % | 43,57 % (statements) / 51,42 % (branches) sur l'ensemble du module `financings/**` |

Les deux mesures ne sont pas directement fusionnées ici (rapports Istanbul distincts, deux
configurations Jest) — un vrai chiffre combiné est un raffinement possible d'un lot suivant, pas
fait maintenant pour ne pas gonfler artificiellement un nombre sans l'avoir vérifié.

## Limitation constatée — sandbox de développement, pas la CI

Ce bac à sable Claude Code a un démon Docker fonctionnel, mais sa politique réseau sortante bloque
la sortie vers les registres d'images (`production.cloudfront.docker.com` pour Docker Hub,
`pkg-containers.githubusercontent.com` pour GHCR — confirmé par `docker pull` réel donnant
`403 Forbidden`, et par `/root/.ccr/README.md` : « 403/407 from the proxy: the destination host is
not allowed by your organization's egress policy — do not retry or route around it »). Résultat :
ni Testcontainers ni `docker compose build` ne peuvent télécharger la moindre image de base
(`postgres:16.10-alpine`, `node:22-bookworm-slim`...) **dans ce sandbox précis** — vérifié pour les
deux (`docker pull postgres:16.10-alpine` et `docker compose build api` donnent la même erreur).
Ce n'est pas spécifique à ce lot : toute PR qui aurait besoin de reconstruire les images Docker
localement dans ce sandbox se heurterait à la même politique.

Ce n'est pas un problème de portabilité du code : les runners GitHub Actions (`ubuntu-latest`) ont
un accès réseau normal aux registres et exécuteront le chemin Testcontainers réel sans
intervention — c'est exactement ce que fait déjà le job `docker` existant (Trivy depuis `ghcr.io`,
`postgres:16.10-alpine` via `docker-compose.yml`) avec succès sur PR #38. Pour vérifier la logique
malgré tout **avant de pousser** (jamais pousser sans validation locale, Règle 1), PostgreSQL 16 a
été installé nativement dans ce sandbox via `apt` (réseau autorisé, contrairement aux registres
d'images) et les 12 tests ont tourné dessus via `TEST_DATABASE_URL` — mêmes assertions, même code
de production (`DatabaseService`, `FinancingsRepository`, `FinancingsService`), seule la manière
d'obtenir un PostgreSQL vide diffère. Le nouveau job CI `integration-tests` (`.github/workflows/ci.yml`)
utilisera le vrai chemin Testcontainers hermétique — sa réussite en CI est la vérification de
référence, à confirmer avant fusion de la PR.

## Prochaine étape recommandée

Suite du Lot 2, chacun en PR séparée : intégration réelle des modules `administration`, `committee`
et `partner` (isolation PME, décisions de comité, accès croisé entre banques partenaires) contre le
même harnais ; intégration MinIO réelle pour `documents`/`document-storage` ; matrice Playwright
multi-navigateurs (Chromium/Firefox/WebKit) et mobile (Android/iPhone) ; régression visuelle.
