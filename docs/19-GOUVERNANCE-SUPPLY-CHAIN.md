# Étape 15 — Sprint Enterprise 0, Lot 1 : gouvernance GitHub et supply chain

## Objectif et périmètre

Premier lot du **Sprint Enterprise 0** : avant d'ajouter la moindre fonctionnalité métier
supplémentaire, mettre en place la gouvernance et les contrôles de chaîne d'approvisionnement
logicielle qu'une plateforme institutionnelle de ce niveau de criticité doit porter. Aucun code
applicatif touché dans ce lot — uniquement la gouvernance GitHub, la CI/CD et une dépendance
vulnérable corrigée.

## Ce qui a été fait

### Gouvernance

- **`.github/CODEOWNERS`** — un seul mainteneur aujourd'hui, donc une règle générale plus
  quelques zones sensibles listées explicitement (politique de sécurité, migrations, CI/CD) pour
  que l'ajout d'un deuxième mainteneur n'exige qu'une ligne à éditer.
- **`.github/pull_request_template.md`** — reprend la structure déjà utilisée organiquement pour
  chaque PR de ce dépôt (Contexte/Contenu/Validation locale), plus les sections désormais
  obligatoires : Risques, Captures desktop/mobile (pour tout changement d'interface), Statut
  explicite (FAIT/PARTIEL/NON FAIT/BLOQUÉ/DÉCISION REQUISE).
- **`SECURITY.md`** — canal de signalement responsable (pas d'issue publique), délais de réponse
  visés, ce qu'il ne faut jamais transmettre (aucune donnée PME réelle).

### Chaîne d'approvisionnement logicielle

- **`.github/dependabot.yml`** — mises à jour groupées hebdomadaires par écosystème (npm/pnpm,
  Docker pour les deux `Dockerfile`, GitHub Actions) plutôt qu'une PR par paquet : ce dépôt a un
  seul mainteneur, une avalanche de PR individuelles serait du bruit plutôt que de la sécurité.
- **`.github/workflows/codeql.yml`** — analyse statique JavaScript/TypeScript sur chaque
  push/PR vers `main`, plus une exécution hebdomadaire (une nouvelle règle CodeQL peut révéler un
  problème existant sans qu'aucun code n'ait changé).
- **`scripts/check-licenses.py`** — garde-fou de licence ajouté à `scripts/test-prepush.sh` :
  échoue si une dépendance future porte une licence copyleft forte (GPL/AGPL) ou non-commerciale/
  partage-à-l'identique (CC-BY-NC, CC-BY-SA), incompatible avec `LICENSE` (propriétaire). Vérifié
  dans les deux sens : passe sur les 873 paquets actuels du dépôt (aucune licence copyleft forte
  actuellement présente - LGPL/MPL, présentes en petit nombre, sont explicitement autorisées : la
  consommation d'une dépendance LGPL/MPL non modifiée n'impose aucune obligation de publier le
  code de ce dépôt), et échoue bien sur une entrée `GPL-3.0-only`/`AGPL-3.0` injectée
  artificiellement pour le test.
- **`.gitleaks.toml`** — scan de secrets (voir CI ci-dessous) avec une liste d'exclusion limitée à
  deux faux positifs vérifiés : les libellés de séparation de contexte HMAC
  (`fodip-mfa-secret-encryption-v1` et consorts, voir `apps/api/src/security-policy.js` et son
  usage dans `mfa.service.ts`/`oidc.service.ts`/`administration.repository.ts`/
  `data-rights.repository.ts`) ne sont pas des secrets - ce sont des étiquettes publiques
  combinées au vrai secret (`JWT_SECRET`) pour dériver des clés indépendantes par fonctionnalité.
  Vérifié en scannant réellement l'historique complet du dépôt (`gitleaks git`, binaire officiel
  téléchargé et exécuté ici, pas supposé) : sans la liste d'exclusion, ces deux libellés
  remontent ; avec elle, zéro faux positif ; et un vrai secret de test injecté (motif de clé
  Stripe) est toujours détecté - la liste d'exclusion ne masque donc pas autre chose qu'elle ne
  devrait.
- **`.trivyignore`** — vide par construction (rien n'a encore été identifié comme devant être
  différé), présent uniquement pour que l'étape Trivy de la CI ait un vrai fichier à monter.

### Vulnérabilité corrigée

`pnpm audit --prod` remontait une vulnérabilité **haute** (injection de code via `_.template` de
lodash, [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc)) et deux
**modérées** (pollution de prototype), toutes trois transitives via `@nestjs/config@4.0.2 >
lodash@4.17.21`. `@nestjs/config` bump vers `4.0.4` (version corrective mineure, même ligne
majeure, peer dependencies inchangées - `@nestjs/common ^10.0.0 || ^11.0.0`, compatible avec la
version 11 déjà utilisée ici) : `4.0.4` embarque `lodash@4.18.1`, corrigé. `pnpm audit --prod`
retourne désormais zéro vulnérabilité.

Trois vulnérabilités additionnelles (2 hautes, 1 modérée), uniquement dans les outils de
compilation (`@nestjs/cli` → `webpack`/`@angular-devkit`, jamais expédiées vers l'image de
production), corrigées par des `pnpm.overrides` ciblés et bornés à la même ligne majeure
(`glob@^11.1.0`, `picomatch@^4.0.4`, `ajv@^8.18.0`) - un premier essai avec des bornes ouvertes
avait fait sauter `glob` deux versions majeures plus loin (13.x) que nécessaire, corrigé avant
commit une fois remarqué en relisant le diff du lockfile. Deux vulnérabilités basses restent
(SSRF via `webpack`'s `buildHttp`, une fonctionnalité expérimentale que ce dépôt n'utilise pas) -
laissées telles quelles : le correctif exigerait un bump majeur de `webpack`, pour un risque bas
sur un outil de compilation qui ne traite jamais d'entrée non fiable ici.

### CI durcie et parallélisée

`.github/workflows/ci.yml` : un seul job séquentiel de 25 minutes remplacé par cinq jobs, dont
quatre parallèles (`invariants`, `unit-tests`, `build`, `security`) et un cinquième (`docker`, le
plus coûteux : Docker Compose, scan Trivy des deux images, génération de SBOM, tests Playwright)
qui ne démarre qu'une fois les quatre premiers verts - un lint cassé n'attend plus 20 minutes de
Docker Compose pour être signalé, et ne coûte plus ces 20 minutes de calcul CI non plus. Détail :

- `pnpm install --no-frozen-lockfile` → `pnpm install --frozen-lockfile` partout ;
- chaque Action GitHub épinglée par SHA immuable (le commentaire `# vX.Y.Z` reste lisible, mais
  c'est le SHA qui s'exécute) - SHA récupérés en résolvant les tags réels via `git ls-remote`
  contre les dépôts amont, pas devinés ;
- `security` : `pnpm audit --prod`, `scripts/check-licenses.py`, scan de secrets (`gitleaks`,
  image Docker épinglée par version exacte), et `dependency-review-action` sur les PR (bloque une
  dépendance nouvellement introduite avec une vulnérabilité haute ou une licence interdite avant
  même le merge) ;
- `docker` : scan Trivy (`--scanners vuln,secret`, sévérité CRITICAL/HIGH, échoue le job) des deux
  images construites, puis génération d'un SBOM CycloneDX par image, uploadés comme artefacts CI
  (rétention 90 jours) ;
- `unit-tests` : couverture collectée (`--coverage`) et uploadée comme artefact (rétention 30
  jours) - premier chiffre réel plutôt que supposé, voir plus bas.

## Vérifié

Conformément à la règle « n'exécute rien tant que Docker Desktop n'est pas disponible sans le
signaler clairement » : **aucun démon Docker capable de tirer des images depuis un registre n'est
disponible dans cet environnement de préparation** (politique réseau documentée dans
`/root/.ccr/README.md` - confirmé une fois de plus ici en tentant un vrai `docker build`, qui
échoue avec un 403 direct du CDN de blobs Docker Hub). Deux catégories de vérification, donc :

**Vérifié directement, sans Docker** :

- `pnpm install --frozen-lockfile` depuis un `node_modules` entièrement supprimé, deux fois (avant
  et après avoir resserré les `pnpm.overrides`) : succès les deux fois ;
- `pnpm audit --prod` : zéro vulnérabilité (était 1 haute + 2 modérées) ;
- `pnpm audit` (tout, y compris devDependencies) : 2 basses restantes, documentées ci-dessus
  (était 2 hautes + 2 modérées + 2 basses) ;
- `pnpm test:prepush`, `pnpm lint`, `pnpm --filter @fodip/api build`, `pnpm --filter @fodip/api
  test` (112/112, avec couverture - voir chiffres ci-dessous), `pnpm --filter @fodip/web build`,
  `docker compose config --quiet` : tous verts, avant et après le resserrement des overrides ;
- `python3 scripts/check-licenses.py` : passe sur l'état réel du dépôt, et testé pour échouer sur
  une licence copyleft forte injectée artificiellement ;
- `gitleaks git . -c .gitleaks.toml` (binaire officiel v8.30.1, téléchargé et exécuté ici) contre
  l'historique complet réel du dépôt (55 commits) : zéro fuite, avec vérification croisée qu'un
  vrai motif de secret est toujours détecté (voir plus haut) ;
- les deux workflows (`ci.yml`, `codeql.yml`) validés avec `actionlint` (avec intégration
  `shellcheck` active) : zéro avertissement ;
- YAML de `dependabot.yml` et des deux workflows chargé avec `yaml.safe_load` : syntaxiquement
  valide ;
- les noms d'image réels que produira `docker compose build` (`fodip-digital-api`,
  `fodip-digital-web`) confirmés via `docker compose config --images` plutôt que devinés.

**Non vérifié ici, à confirmer par la CI réelle** (premier passage sur ce lot) : construction
effective des deux images Docker, scan Trivy contre les images réelles, génération des SBOM,
`scripts/docker-smoke.sh`, `scripts/test-backup-restore.sh`, et la suite Playwright contre la
pile Docker Compose complète - tout ce qui exige de réellement tirer `postgres:16.10-alpine`,
`minio/minio:...` et de construire les deux images applicatives.

## Couverture de tests (référence pour le Lot 2)

Premier chiffre réel de ce dépôt, jamais mesuré jusqu'ici :

| Métrique | Valeur actuelle | Cible (Lot 2) |
|---|---|---|
| Instructions | 65,51 % | > 80 % |
| Branches | 38,75 % | > 75 % |
| Fonctions | 45,63 % | — |
| Lignes | 66,55 % | > 80 % |

Sans surprise très en-dessous des cibles du Sprint Enterprise 0 : la suite actuelle teste chaque
règle métier au niveau service avec des dépôts simulés (`jest.fn()`), jamais contre un vrai
PostgreSQL/MinIO - exactement le manque que le Lot 2 (tests d'intégration réels, modules
financiers critiques en priorité) doit combler.

## DÉCISION REQUISE — réglages GitHub que ce dépôt ne peut pas activer lui-même

Deux réglages ne peuvent être changés que depuis les paramètres du dépôt sur GitHub, hors de
portée de tout fichier versionné ou des outils disponibles dans cette session (confirmé : aucun
outil d'accès à l'API des paramètres de sécurité ou de protection de branche) :

- **Protection de la branche `main`** (Settings → Branches) : PR obligatoire, CI obligatoire,
  branche à jour avant fusion, deux validations sur les zones sensibles, interdiction du push
  direct et du force-push, `CODEOWNERS` obligatoire - tout ce que le Lot 1 met en place
  (`.github/CODEOWNERS`, statuts CI nommés) n'a d'effet contraignant qu'une fois cette protection
  activée.
- **Dependency graph** (Settings → Security → Code security and analysis) : sans lui,
  `dependency-review-action` (job `security` de `ci.yml`) échoue avec « Dependency review is not
  supported on this repository » - trouvé en conditions réelles sur la première PR à déclencher
  cette étape (`pull_request`, jamais exercée par les runs `push` précédents). Corrigé en
  `continue-on-error: true` pour ne jamais bloquer une PR sur un réglage que ce workflow ne
  contrôle pas - `pnpm audit`/`check-licenses.py` continuent de bloquer normalement en attendant.
  Une fois Dependency graph activé, cette étape redevient pleinement bloquante sans autre
  changement de code.

## Un vrai bug d'architecture Docker que le scan Trivy a trouvé dès son premier vrai passage

Le scan Trivy (axe C4 - premier passage réel sur PR #38, cette fois avec la bonne image
`ghcr.io/aquasecurity/trivy`) a trouvé de vraies vulnérabilités CRITICAL/HIGH dans les deux
images : des paquets Debian du système (`perl-base`, `zlib1g`, `bsdutils` - certaines sans
correctif Debian disponible pour l'instant, `will_not_fix`/`fix_deferred`) et, plus significatif,
`tar`/`brace-expansion` **provenant du côté `devDependencies` de l'API** (`@nestjs/cli` et sa
propre chaîne `webpack`/`glob`) retrouvés **dans l'image `web`**.

Root cause, pas une CVE isolée à corriger au cas par cas : les deux `Dockerfile` faisaient
`pnpm install --frozen-lockfile` **à la racine du workspace**, sans `--filter` ni `--prod`. Dans
un monorepo pnpm, cette commande résout et installe les dépendances de **tous** les paquets du
workspace dans le même `node_modules` partagé - les `devDependencies` de l'API se retrouvaient
donc dans l'image `web` et réciproquement, en plus des `devDependencies` de chaque paquet
lui-même. Un `COPY node_modules` naïf embarquait tout ça dans l'image de production : `jest`,
`eslint`, `@nestjs/cli`, `webpack`, `ts-jest`... jamais nécessaires à l'exécution, uniquement à la
compilation, mais bien présents et scannés par Trivy dans l'image finale.

Corrigé avec `pnpm deploy --prod` (commande pnpm dédiée à exactement ce cas : produire, pour un
seul paquet d'un workspace, un `node_modules` autonome ne contenant que ses propres dépendances
de production) plutôt qu'un correctif ponctuel par CVE - qui n'aurait rien réglé pour la
prochaine dépendance de compilation vulnérable. Vérifié directement (pas supposé) : `pnpm
--filter @fodip/api deploy --prod` et son équivalent web exécutés ici, contenu du `node_modules`
déployé inspecté (aucune trace de `jest`/`eslint`/`@nestjs/cli` côté API, aucune trace des
équivalents web), et les deux applications démarrées avec succès depuis leur répertoire déployé
(`node dist/main.js` pour l'API répond correctement sur toutes ses routes ; `next start` pour le
web sert la page d'accueil et `/manifest.webmanifest` en 200).

`scripts/check-docker.py` (garde-fou `public/` de la PR #29) ajusté au passage : la
restructuration change le chemin source de la copie de `public/` dans le Dockerfile web
(`/app/deploy/public` au lieu de `apps/web/public`) - le garde-fou vérifiait la chaîne exacte de
l'ancien chemin, resserré pour vérifier l'invariant réel (« `public/` est copié quelque part »)
plutôt qu'un chemin source spécifique, testé dans les deux sens comme la première fois.

Les paquets Debian sans correctif disponible (`will_not_fix`/`fix_deferred`) ne peuvent pas être
corrigés depuis ce dépôt - ils dépendent du mainteneur Debian ou d'une future image de base. Pas
encore ajoutés à `.trivyignore` : la prochaine exécution de la CI, avec les images `node_modules`
désormais propres, dira précisément lesquels restent réellement bloquants une fois le bruit des
`devDependencies` mal placées éliminé.
