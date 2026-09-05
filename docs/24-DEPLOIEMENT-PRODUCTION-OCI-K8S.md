# Étape 24 — Cible de production OCI/Kubernetes (axe E7)

## Objectif et périmètre

Axe E7 (`docs/14-ROADMAP-SAAS-PREMIUM.md`) — la dernière ligne restante de l'architecture Docker
entreprise : une cible de production documentée sur une image OCI standard et Kubernetes, **sans
dépendance à un fournisseur cloud particulier**. Ce document complète, sans le remplacer :

- `docs/15-DEPLOIEMENT-TEST.md` — un environnement de test/démo sur des PaaS gérés (Render,
  Netlify, Neon, Supabase, Cloudflare R2) : plus rapide à mettre en place, mais pas la cible de
  production visée ici.
- `docs/19-GOUVERNANCE-SUPPLY-CHAIN.md` — la chaîne d'approvisionnement des images elles-mêmes
  (scan Trivy, SBOM signé) : ce document suppose ces images déjà construites et publiées.

Périmètre : les manifestes Kubernetes de `k8s/` déploient exactement ce que
`docker-compose.yml` déploie en local pour `api`/`web`/les migrations - pas PostgreSQL ni le
stockage S3-compatible eux-mêmes, dont le choix (managé ou auto-hébergé) reste délibérément hors
périmètre : n'importe quel PostgreSQL et n'importe quel stockage compatible S3 conviennent, c'est
tout le principe de ne pas dépendre d'un cloud particulier.

## Vue d'ensemble

```text
                         Ingress (nginx/Traefik/... - au choix du cluster)
                                          │
                                          ▼
                              Service fodip-web (3000)
                                          │
                              Deployment fodip-web (2 réplicas)
                                          │
                          API_BASE_URL (interne au cluster)
                                          ▼
                              Service fodip-api (4000)
                                          │
                              Deployment fodip-api (2 réplicas)
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
             PostgreSQL            Stockage S3-compatible   IdP OIDC (optionnel,
        (managé ou auto-hébergé,   (MinIO auto-hébergé ou    axe B4 - Keycloak
         hors périmètre ici)        tout autre fournisseur)   ou tout IdP standard)
```

Les deux images (`fodip-digital-api`, `fodip-digital-web`) sont des images OCI standard,
construites depuis `apps/api/Dockerfile`/`apps/web/Dockerfile` sans rien de spécifique à un
registre ou un cloud - `docker build`, en poussant vers n'importe quel registre compatible OCI
(Docker Hub, GHCR, Harbor auto-hébergé, le registre intégré de votre cluster...).

## Manifestes (`k8s/`)

| Fichier | Rôle |
|---|---|
| `00-namespace.yaml` | Namespace `fodip` |
| `01-configmap.yaml` | Configuration non secrète (mêmes variables que `docker-compose.yml`, valeurs de production - ex. `DATABASE_SSL: "true"`, `COOKIE_SECURE: "true"`) |
| `02-secret.example.yaml` | **Gabarit** - copier en `02-secret.yaml` (ignoré par `.gitignore`), remplir les vraies valeurs, ne jamais commiter la copie. Préférer la gestion de secrets réelle de votre cluster (sealed-secrets, external-secrets, SOPS...) quand elle est disponible - ce gabarit est le minimum qui fonctionne partout, pas la fin visée. |
| `03-migration-job.yaml` | `Job` unique exécutant `scripts/run-migrations.js` (le même runner que le service `migrations` de `docker-compose.yml`, avec sa vérification de somme de contrôle et son verrou consultatif PostgreSQL) |
| `04-api-deployment.yaml` | `Deployment` (2 réplicas) + `Service` pour l'API |
| `05-web-deployment.yaml` | `Deployment` (2 réplicas) + `Service` pour le web |
| `06-ingress.example.yaml` | **Gabarit** - nécessite un contrôleur Ingress déjà installé dans le cluster (délibérément non imposé ici) |
| `07-network-policies.yaml` | Refus par défaut du trafic entrant, exposition du web et flux web vers API uniquement |
| `08-pod-disruption-budgets.yaml` | Maintien d'au moins un pod API et web lors des interruptions volontaires |
| `kustomization.yaml` | Base Kustomize auditable ; exclut volontairement les gabarits de secret et d'Ingress |

Ordre d'application :

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secret.yaml   # votre copie remplie, jamais le .example
kubectl apply -f k8s/03-migration-job.yaml
kubectl wait --for=condition=complete job/fodip-migrate -n fodip --timeout=120s
kubectl apply -f k8s/04-api-deployment.yaml
kubectl apply -f k8s/05-web-deployment.yaml
kubectl apply -f k8s/07-network-policies.yaml
kubectl apply -f k8s/08-pod-disruption-budgets.yaml
# k8s/06-ingress.yaml (votre copie de 06-ingress.example.yaml) une fois le contrôleur Ingress choisi
```

Après création du secret réel et adaptation de l'Ingress, la base peut aussi être rendue ou
appliquée avec `kubectl kustomize k8s/` / `kubectl apply -k k8s/`. Le secret et l'Ingress ne sont
jamais inclus automatiquement : cela empêche de déployer par erreur leurs valeurs `CHANGE_ME`.

### Pourquoi deux réplicas par défaut, pas un

Axe E4 (`docs/14-ROADMAP-SAAS-PREMIUM.md`) : jusqu'à une itération récente, ce dépôt n'aurait pas
pu recommander plus d'un réplica de l'API en toute sécurité. Le rate limiting
(`ThrottlerModule`) et la révocation de session tenaient leur état dans une `Map` en mémoire
par processus - un deuxième réplica aurait silenciairement multiplié le budget réel de chaque
route limitée (`/auth/login` compris) et laissé un jeton révoqué continuer à passer contre le
réplica qui n'avait pas vu la révocation. Les deux sont désormais portés par PostgreSQL
(`PostgresThrottlerStorageService`, `RevocationService`), partagé entre tous les réplicas - deux
réplicas par défaut n'est plus une lacune silencieuse.

### Sondes de disponibilité (probes)

L'API distingue désormais deux signaux publics, sans donnée sensible :

- `GET /api/v1/health/live` confirme seulement que le processus répond ; une panne PostgreSQL ou
  S3 ne provoque donc pas une boucle de redémarrage ;
- `GET /api/v1/health/ready` vérifie réellement PostgreSQL et le bucket S3-compatible. Il renvoie
  `503` avec les seuls états `up`/`down` si une dépendance critique manque ; Kubernetes retire alors
  le pod du Service jusqu'au rétablissement.

`GET /api/v1/health` reste un alias de liveness pour la compatibilité avec le `HEALTHCHECK` OCI et
les intégrations existantes. Le web conserve `GET /` pour ses deux probes.

### Disponibilité et durcissement

- mises à jour `RollingUpdate` avec `maxUnavailable: 0`, `maxSurge: 1` et délai de disponibilité ;
- deux réplicas et un `PodDisruptionBudget` avec `minAvailable: 1` pour l'API et le web ;
- arrêt gracieux NestJS sur `SIGTERM` et délai Kubernetes de 30 secondes ;
- profil Pod Security Admission `restricted`, seccomp `RuntimeDefault`, toutes les capabilities
  Linux supprimées, système de fichiers racine en lecture seule et jeton de ServiceAccount non
  monté ;
- `DEMO_MODE: "false"` explicite dans la configuration de production ;
- `NetworkPolicy` en refus entrant par défaut, puis autorisation du contrôleur Ingress vers le web
  et du web vers l'API. La règle Ingress, volontairement indépendante du fournisseur, doit être
  resserrée sur le namespace et les labels du contrôleur choisi lors de la décision d'hébergement.

## Vérifié

- Les manifestes initiaux ont été validés contre le schéma Kubernetes avec `kubeconform` v0.6.7.
  Le contrôle `scripts/check-k8s.py`, désormais exécuté à chaque pré-push/CI, interdit la régression
  des invariants de sécurité, disponibilité, probes et exclusion des gabarits.
- Les routes de sonde (`/api/v1/health`, `/`) et les ports (4000, 3000) confirmés directement
  contre `apps/api/Dockerfile`/`apps/web/Dockerfile`/`docker-compose.yml`, pas devinés.
- La liste de variables d'environnement de `01-configmap.yaml`/`02-secret.example.yaml` confirmée
  exhaustive par lecture directe du service `api`/`web` de `docker-compose.yml` (chaque variable
  qu'il définit a son équivalent ici, à l'exception de celles propres à la stack de démo locale -
  `CLAMAV_HOST`/`CLAMAV_PORT` optionnels non repris par défaut, `.env.example` documente leur ajout
  si besoin). `DEMO_MODE` est explicitement forcé à `false`.

## Non vérifié ici, à confirmer par un vrai cluster

Aucun démon Docker ni cluster Kubernetes n'est disponible dans ce bac à sable (même limitation
déjà documentée ailleurs dans ce dépôt pour tout travail dépendant de Docker). N'ont donc **pas**
été vérifiés ici, contrairement à ce que `kubeconform` peut confirmer (la forme des manifestes) :

- que les images tournent réellement avec `readOnlyRootFilesystem: true` sans erreur au démarrage
  (l'analyse de code n'a trouvé aucune écriture sur disque applicative - voir les commentaires de
  `04-api-deployment.yaml`/`05-web-deployment.yaml` - mais seul un vrai pod le confirmerait) ;
- que le `Job` de migration se termine réellement avec `kubectl wait --for=condition=complete` ;
- que les probes passent réellement au démarrage à froid contre un vrai Postgres/stockage S3 ;
- le comportement réel à deux réplicas contre une vraie base partagée (la garantie vient des tests
  d'intégration `postgres-throttler-storage.integration-spec.ts`/`revocation.integration-spec.ts`,
  qui prouvent la même logique contre un vrai PostgreSQL, mais pas depuis deux pods Kubernetes
  réels).

Reste, pour fermer la porte d'homologation sur le cluster cible : intégrer un gestionnaire de
secrets réel plutôt que le gabarit `02-secret.example.yaml`, remplacer les images `CHANGE_ME` par
des digests issus du registre OCI institutionnel, créer les adaptations REC/PPD/PROD et valider
un déploiement complet. Une politique egress en refus par défaut sera ajoutée après choix des
destinations PostgreSQL, S3, OIDC, DNS et observabilité ; la deviner avant la décision
d'hébergement rendrait le manifeste soit inopérant, soit faussement permissif.
