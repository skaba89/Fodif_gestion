# Étape 16 — Sprint Enterprise 0, Lot 2 : tests entreprise, modules métier critiques

## Objectif et périmètre

Axe E2 de `docs/14-ROADMAP-SAAS-PREMIUM.md`. Couvre les cinq modules métier critiques identifiés
dans la mission contre un vrai PostgreSQL (et, pour `documents`, un vrai stockage compatible S3),
pas des mocks : `financings` (financements, décaissements, remboursements, échéances), `committee`
(décisions du comité de financement), `administration` (comptes utilisateurs, rôles, protection du
dernier SUPER_ADMIN), `partner` (portail banque partenaire, isolation entre banques) et `documents`
(upload/téléchargement de justificatifs via MinIO/S3, intégrité par checksum, isolation PME). Ne
couvre pas encore : la matrice Playwright multi-navigateurs/mobile, ni la régression visuelle —
chacun un lot séparé à venir (jamais une PR géante).

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
  Expose `reset()` (TRUNCATE CASCADE de toutes les tables *sauf* `roles`/`permissions`/
  `role_permissions` entre deux tests, rapide — voir « Un vrai bug de harnais » ci-dessous) et
  `stop()`. Un seul conteneur par fichier de test (`beforeAll`), pas par cas de test : le démarrage
  prend plusieurs secondes, `reset()` entre chaque test est presque instantané.
- **`fixtures.ts`** : générateurs de données minimales (entreprise + dossier + décision de comité
  APPROUVE, entreprise + dossier prêt pour le comité avec un score complet, utilisateur, utilisateur
  déjà rattaché à des codes de rôle donnés) avec identifiants uniques par appel pour ne jamais
  entrer en collision entre tests.
- **`jest.integration.config.js`** : configuration Jest séparée (`testRegex:
  '.*\.integration-spec\.ts$'`), **volontairement exclue** de `jest.config.js` (qui ne matche que
  `*.spec.ts` / `*.e2e-spec.ts`) — ces specs ont besoin d'un démon Docker et prennent plusieurs
  secondes par fichier ; elles ne doivent jamais ralentir ni faire échouer `pnpm test` sur une
  machine sans Docker qui tourne.
- Nouveau script `pnpm --filter @fodip/api test:integration`.

- **`storage.ts`** : le pendant S3 de `database.ts`. Démarre un conteneur `minio/minio` jetable via
  `@testcontainers/minio` (épinglé à `12.1.0`, même version que `testcontainers`/
  `@testcontainers/postgresql`) — exactement l'image que `docker-compose.yml` épingle pour le
  service `minio`. Construit un vrai `DocumentStorageService` (la classe de production) branché
  dessus via `ConfigService`, expose `reset()` (vide le bucket de test entre deux tests) et
  `stop()`, plus un helper `corruptStoredObject()` qui écrase les octets d'un objet déjà stocké en
  place — utilisé pour simuler une corruption côté stockage et vérifier que le contrôle d'intégrité
  de `DocumentsService#downloadVerified` la détecte réellement.

### Échappatoire `TEST_DATABASE_URL` / `TEST_STORAGE_ENDPOINT` (pourquoi, voir plus bas)

`database.ts` accepte une variable d'environnement `TEST_DATABASE_URL`, et `storage.ts` son
équivalent `TEST_STORAGE_ENDPOINT` (+ `TEST_STORAGE_ACCESS_KEY`/`TEST_STORAGE_SECRET_KEY`) : si
elle est définie, le harnais se connecte directement à cette base/cet endpoint au lieu de démarrer
un conteneur (mais applique quand même les migrations, ou fournit `reset()`/`stop()`, normalement).
**Non définies en CI** — la CI utilise le chemin normal, hermétique, via Testcontainers. Cette
échappatoire a servi à la vérification locale (voir « Limitation constatée » plus bas) et reste
utile pour tout environnement où Testcontainers ne peut pas atteindre un registre d'images mais où
un vrai PostgreSQL ou un vrai stockage compatible S3 jetable est disponible autrement.

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

### Specs (`apps/api/test/integration/committee.integration-spec.ts`, 6 tests)

`committee.repository.ts` n'avait que **22,22 % de couverture de lignes** avant ces tests (mêmes
raisons que pour `financings.repository.ts` : `test/committee.service.spec.ts` mocke entièrement le
repository). `CommitteeRepository.decide` protège la concurrence avec un seul `UPDATE ... WHERE
statut = 'PRET_COMITE'` atomique (pas de verrou explicite `FOR UPDATE` séparé, contrairement à
`financings`) — un pattern différent, qui mérite sa propre vérification en conditions réelles.

| Scénario demandé dans la mission | Test |
|---|---|
| Cas nominal | Décision `APPROUVE` : dossier passe à `APPROUVE`, historique de statut (`dossier_statuts_historique`) et entrée d'audit `COMMITTEE_DECISION` créés |
| Règle métier | Montant approuvé au-dessus du montant demandé → `BadRequestException` ; décision `REJETE` sans commentaire motivé → `BadRequestException` |
| Transition de statut interdite | Décider deux fois le même dossier (statut déjà changé par la première décision) → `ConflictException` la seconde fois |
| Double-clic / double-soumission | Deux membres du comité décident le même dossier en même temps (une `APPROUVE`, une `REJETE`) → une seule réussit, une seule ligne dans `decisions_comite`, le statut final du dossier correspond exactement à la décision qui a réellement gagné la course (pas supposé être la première) |
| Liste | Seuls les dossiers `PRET_COMITE` apparaissent dans la file du comité |

### Specs (`apps/api/test/integration/administration.integration-spec.ts`, 9 tests)

Deux choses que les mocks ne peuvent structurellement pas vérifier ici : le chiffrement AES-256-GCM
du numéro de téléphone (axe B5) réellement écrit puis relu depuis PostgreSQL (pas une valeur en
mémoire), et le verrou global `pg_advisory_xact_lock(80913001)` qui protège le dernier compte
SUPER_ADMIN actif d'une suppression par deux requêtes concurrentes.

| Scénario demandé dans la mission | Test |
|---|---|
| Chiffrement au repos | Téléphone jamais stocké en clair (`SELECT` direct sur la colonne) ; `listUsers` le déchiffre correctement |
| Règle métier | Rôle privilégié → MFA forcé même si l'appelant demande explicitement `mfaRequired: false` ; email dupliqué → `ConflictException` (contrainte unique réelle) ; code de rôle inconnu → `BadRequestException` |
| Transition de statut interdite | Un utilisateur ne peut jamais se désactiver lui-même ; désactiver le seul SUPER_ADMIN actif est refusé ; désactiver un SUPER_ADMIN quand un autre reste actif est autorisé |
| Double-clic / double-soumission | Deux requêtes concurrentes désactivent chacune l'un des deux seuls SUPER_ADMIN actifs → une seule réussit, il reste toujours exactement un SUPER_ADMIN actif (jamais zéro) |
| Audit | Une modification de rôle réussie écrit une entrée `UPDATE_USER` dans `audit_logs` |

### Un vrai bug de harnais trouvé en écrivant ces tests : `reset()` effaçait les données de référence

`database.ts` faisait un `TRUNCATE` de **toutes** les tables `public` entre deux tests, y compris
`roles`, `permissions` et `role_permissions` — des tables que les migrations elles-mêmes peuplent
une seule fois par `INSERT` (`grep '^INSERT INTO' database/*.sql`, confirmé exhaustif : ce sont les
trois seules) et qu'aucun code applicatif ne modifie jamais (`grep` sur `INTO`/`UPDATE`/`DELETE`
contre les trois dans `apps/api/src` : zéro résultat) — des données de référence figées par le
schéma, pas des fixtures de test.

Conséquence concrète, découverte en écrivant le tout premier test de ce fichier qui en dépend : le
tout premier `beforeEach` de **n'importe quel** fichier de spec vidait la table `roles`, et comme
les migrations ne tournent qu'une fois dans `beforeAll`, elle restait vide pour tout le reste du
fichier. `financings` et `committee` n'avaient jamais remarqué ce bug parce qu'aucun des deux ne
dépend de rôles pré-semés. Deux symptômes réels observés avant le correctif :
- `service.createUser(..., { roles: ['ANALYSTE'] })` échouait avec `BadRequestException:
  INVALID_ROLE` — un rôle pourtant réel et seedé par migration ;
- le test « interdit de désactiver le seul SUPER_ADMIN actif » **passait pour la mauvaise raison** :
  `seedUserWithRoles(['SUPER_ADMIN'])` n'assignait en réalité aucun rôle (la table `roles` était
  vide), donc la garde `canDeactivateUser` autorisait la désactivation — pas parce qu'elle protégeait
  correctement, mais parce que l'utilisateur ciblé n'avait techniquement plus aucun rôle à protéger.

Corrigé en excluant ces trois tables du `TRUNCATE` (`SEED_ONLY_TABLES` dans `database.ts`, avec
commentaire expliquant pourquoi). Ce correctif profite à `financings` et `committee` aussi bien
qu'à `administration`, et à chaque futur module du Lot 2.

### Specs (`apps/api/test/integration/partner.integration-spec.ts`, 9 tests)

Le portail banque partenaire est le scénario « accès croisé entre banques » cité explicitement dans
la mission. Le périmètre visible d'un partenaire (`PARTNER_SCOPE` dans `partner.repository.ts`) est
l'union de deux mécanismes indépendants (`database/011_partner_banks.sql`) : banque correspondante
désignée sur un financement, ou PME de son portefeuille client. Un repository mocké peut vérifier
que le bon fragment SQL a été appelé ; seule une vraie jointure contre de vraies lignes prouve
qu'une banque ne peut effectivement jamais atteindre les données d'une autre.

| Scénario demandé dans la mission | Test |
|---|---|
| Accès croisé entre banques partenaires | Un financement de la banque B n'apparaît jamais dans la liste de la banque A ; `get()` sur ce financement lève `NotFoundException` ; déclarer un décaissement dessus lève `NotFoundException` |
| Défense en profondeur | Le repository lui-même refuse l'écriture pour un financement hors périmètre — appelé directement, sans passer par la pré-vérification `get()` du service — vérifié qu'aucune ligne n'est insérée |
| Double mécanisme de périmètre | Un financement sans banque correspondante désignée reste visible via le seul rattachement au portefeuille PME |
| Dépassement du montant accordé | Décaissement seul au-dessus du solde → `BadRequestException` |
| Double-clic / double-soumission | Deux déclarations de décaissement concurrentes qui tiennent chacune individuellement mais dépassent ensemble le montant accordé → une seule réussit (verrou `FOR UPDATE` scopé au partenaire), le total engagé ne dépasse jamais le montant accordé |
| Trop-perçu au-delà du montant dû | Remboursement seul au-dessus du reste dû → `BadRequestException` |
| Audit | Une déclaration de décaissement réussie écrit une entrée `PARTNER_DECLARE_DISBURSEMENT` attribuée à la bonne banque partenaire |

### Specs (`apps/api/test/integration/documents.integration-spec.ts`, 16 tests)

Le module `documents` est le seul des cinq à dépendre d'un stockage objet réel, pas seulement de
PostgreSQL : `test/documents.service.spec.ts` mocke à la fois le repository et
`DocumentStorageService`, ce qui prouve la logique de branchement mais ne peut structurellement pas
vérifier qu'un fichier uploadé revient identique une fois téléchargé, que le contrôle d'intégrité
SHA-256 de `DocumentsService#downloadVerified` détecte une vraie corruption côté stockage (pas
seulement une valeur de mock différente), ou que l'isolation PME (`dossier_documents` jointe à
`dossiers_financement.entreprise_id`) tient sur une vraie jointure. Décision de périmètre : le
rollback compensatoire (`storage.delete()` si l'insertion en base échoue après un upload réussi
dans `uploadOwn`) n'est pas testé ici — le déclencher naturellement de l'extérieur demanderait de
mocker intrusivement la couche base de données, ce qui casserait la philosophie « boîte noire
réelle » suivie pour les quatre autres modules ; à réévaluer si un déclencheur propre se présente.

| Scénario demandé dans la mission | Test |
|---|---|
| Cas nominal | Upload puis téléchargement : octets identiques à l'octet près, bon nom de fichier, bon type de contenu ; l'objet est réellement présent dans le bucket S3 à la clé annoncée et le checksum stocké correspond au SHA-256 réel du contenu |
| Intégrité du stockage | Objet corrompu directement dans S3 (mêmes métadonnées en base, octets différents) → `downloadOwn` et `downloadForReview` refusent tous les deux avec `ServiceUnavailableException` |
| Isolation PME | Une entreprise ne peut jamais télécharger le document d'une autre (`NotFoundException`, pas la vraie donnée) ; `listOwn` exclut les documents d'une autre entreprise même en interrogeant le bon `dossierId` ; upload refusé sur un dossier appartenant à une autre entreprise |
| Garde-fous d'upload | Dossier hors des statuts éditables (`BROUILLON`/`COMPLEMENT_REQUIS`) → `ForbiddenException` ; type de document hors liste autorisée → `BadRequestException` ; contenu ne correspondant à aucune signature de fichier connue → `BadRequestException` ; mimetype annoncé différent de la signature réelle des octets (protection anti-spoofing) → `BadRequestException` ; aucun objet laissé dans S3 quand l'upload est refusé avant d'atteindre le stockage |
| Vérification | Décision `VALIDE` : `statut_verification`, `verified_by`, `verified_at` mis à jour, entrée d'audit `DOCUMENT_VERIFY` avec l'ancien et le nouveau statut ; décision `A_COMPLETER` sans commentaire → `BadRequestException`, avec commentaire → stocké tel quel |
| Audit d'accès | Téléchargement par la PME propriétaire → entrée `DOCUMENT_DOWNLOAD_PME` ; téléchargement par un agent en revue → entrée `DOCUMENT_DOWNLOAD_AGENT`, distincte |

## Vérifié

Chaque affirmation ci-dessous a été vérifiée réellement, pas supposée :

- **Les 52 tests passent** (12 `financings` + 6 `committee` + 9 `administration` + 9 `partner` + 16
  `documents`) contre un vrai PostgreSQL (et, pour `documents`, un vrai stockage compatible S3),
  chacun exécuté plusieurs fois de suite sans un seul échec intermittent (les tests de concurrence
  sont exactement le genre de test qui peut être flaky s'il est mal conçu — vérifié qu'il ne l'est
  pas, pas juste espéré).
- **Ces tests détectent une vraie régression, pas seulement une régression injectée pour la forme**,
  vérifié pour les cinq modules séparément : le verrou `FOR UPDATE` de `planDisbursement` retiré
  temporairement fait échouer son test de concurrence (conflit de contrainte SQL au lieu du
  `ConflictException` applicatif attendu) ; la clause `WHERE statut = 'PRET_COMITE'` de
  `CommitteeRepository.decide` retirée temporairement fait échouer son test de concurrence (les deux
  décisions concurrentes réussissent, deux lignes dans `decisions_comite` au lieu d'une) ; le
  `pg_advisory_xact_lock` d'`AdministrationRepository.update` retiré temporairement fait échouer son
  test de concurrence (les deux désactivations réussissent — zéro SUPER_ADMIN actif restant, un
  vrai verrouillage de la plateforme) ; retirer `${PARTNER_SCOPE}` de `PartnerRepository.findById`
  fait échouer trois des cinq tests d'isolation immédiatement (une banque peut alors lire les
  données d'une autre), et retirer le verrou `FOR UPDATE` de `createDisbursement` fait échouer son
  test de concurrence de la même façon que pour `financings` ; désactiver le contrôle de checksum
  dans `DocumentsService#downloadVerified` fait échouer les deux tests d'intégrité du stockage (le
  contenu corrompu est renvoyé sans erreur) ; retirer la condition `d.entreprise_id = $2` de
  `DocumentsRepository.findOwnedById` fait échouer le test d'isolation croisée — une entreprise
  télécharge alors réellement le document d'une autre, la fuite exacte que ce test doit empêcher.
  Les cinq fichiers ont été restaurés à l'identique ensuite (`git diff` vide) et la suite complète
  repassée au vert.
- `pnpm --filter @fodip/api lint` : aucune erreur sur les nouveaux fichiers.
- `pnpm --filter @fodip/api test` (suite unitaire existante, 112 tests, 23 fichiers) : toujours au
  vert, aucune régression. Couverture globale inchangée (65,51 % lignes) — attendu, les tests
  d'intégration tournent dans une configuration Jest séparée, non incluse dans cette mesure.
- `npx tsc --noEmit` sur `apps/api` (le `tsconfig.json` du projet inclut déjà `test/**/*`) : aucune
  erreur.
- `pnpm --filter @fodip/api test:prepush`, `pnpm --filter @fodip/api build` et
  `pnpm --filter @fodip/web build` : tous au vert.
- `.github/workflows/ci.yml` validé avec `actionlint` : aucun avertissement.

### Couverture apportée par les tests d'intégration

Mesuré séparément (`--collectCoverageFrom` scopé à chaque module, sur la nouvelle config Jest seule,
sans fusionner avec la suite unitaire) :

| Repository | Avant (unitaire seul, mocks) | Apporté par les tests d'intégration |
|---|---|---|
| `financings.repository.ts` (lignes) | 7,84 % | 43,57 % (statements) / 51,42 % (branches) sur l'ensemble du module `financings/**` |
| `committee.repository.ts` (lignes) | 22,22 % | 48,61 % (lignes) / 75 % (branches) sur l'ensemble du module `committee/**` |
| `partner.repository.ts` (lignes) | non mesuré séparément (mocké dans les tests unitaires de service) | couvre `list`, `findById`, `createDisbursement`, `createRepayment` et les deux mécanismes de `PARTNER_SCOPE` — chemins d'erreur de connexion non exercés |
| `administration.repository.ts` (lignes) | non mesuré séparément (mocké dans `test/administration.repository.spec.ts`) | couvre la création, la mise à jour, le chiffrement PII et la protection SUPER_ADMIN — chemins d'erreur non exercés (base de données indisponible) exclus, comme pour les deux autres modules |

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
d'images) et les tests ont tourné dessus via `TEST_DATABASE_URL` — mêmes assertions, même code de
production (`DatabaseService`, chaque `*Repository`/`*Service`), seule la manière d'obtenir un
PostgreSQL vide diffère. Le job CI `integration-tests` (`.github/workflows/ci.yml`)
utilisera le vrai chemin Testcontainers hermétique — sa réussite en CI est la vérification de
référence, à confirmer avant fusion de la PR.

Même limitation, même contournement pour `documents`/MinIO, avec une contrainte supplémentaire :
l'image `minio/minio` est bloquée par la même politique de registre, **et** le binaire MinIO
lui-même n'est téléchargeable ni via `dl.min.io` (403 par le proxy sortant) ni via `apt` (aucun
paquet serveur MinIO). Comme pour PostgreSQL, la solution n'est pas de contourner la politique
réseau mais de trouver un vrai serveur compatible S3 atteignable par une voie autorisée : le
registre npm l'est, et [`s3rver`](https://www.npmjs.com/package/s3rver) (serveur S3 factice pur
Node, standard pour ce genre de vérification) y est disponible. Lancé localement en éphémère
(`pnpm dlx s3rver@3.7.1 -d <tmp> -a 127.0.0.1 -p <port>`, jamais ajouté à `package.json` ni au
lockfile — seul `@testcontainers/minio` est une vraie dépendance commitée), pointé via
`TEST_STORAGE_ENDPOINT`, il fournit un vrai serveur S3 pour faire tourner `documents.integration-
spec.ts` sans passer par `MinioContainer`. Même raisonnement que pour Postgres : mêmes assertions,
même `DocumentStorageService`/`DocumentsService`/`DocumentsRepository` de production, seule la
manière d'obtenir un endpoint S3 vide diffère. Le job CI `integration-tests` utilisera le vrai
`MinioContainer` (l'image `minio/minio` exacte que `docker-compose.yml` épingle) — sa réussite en
CI reste la vérification de référence.

## Prochaine étape recommandée

Les cinq modules métier critiques cités explicitement dans la mission (`financings`, `committee`,
`administration`, `partner`, `documents`) sont maintenant tous couverts contre un vrai backend réel
(PostgreSQL, et pour `documents` un vrai stockage S3). Reste, chacun en PR séparée : matrice
Playwright multi-navigateurs (Chromium/Firefox/WebKit) et mobile (Android/iPhone) ; régression
visuelle. Un raffinement possible au passage : fusionner les rapports de couverture unitaire +
intégration en un seul chiffre par module (actuellement mesurés séparément, voir plus haut).
