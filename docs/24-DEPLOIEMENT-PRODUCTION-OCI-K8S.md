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

Ordre d'application :

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secret.yaml   # votre copie remplie, jamais le .example
kubectl apply -f k8s/03-migration-job.yaml
kubectl wait --for=condition=complete job/fodip-migrate -n fodip --timeout=120s
kubectl apply -f k8s/04-api-deployment.yaml
kubectl apply -f k8s/05-web-deployment.yaml
# k8s/06-ingress.yaml (votre copie de 06-ingress.example.yaml) une fois le contrôleur Ingress choisi
```

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

Les `readinessProbe`/`livenessProbe` de `04-api-deployment.yaml`/`05-web-deployment.yaml`
utilisent exactement les routes que le `HEALTHCHECK` intégré à chaque image vérifie déjà
(`apps/api/Dockerfile`, `apps/web/Dockerfile`, axe E7) - `GET /api/v1/health` pour l'API (publique,
sans session), `GET /` pour le web (page d'accueil publique). Kubernetes ne lit jamais le
`HEALTHCHECK` Docker lui-même (seul un `docker run`/`docker ps` autonome le ferait) - les probes
ci-dessus sont la vraie vérification côté Kubernetes, avec les mêmes routes pour ne jamais
diverger des deux.

## Vérifié

- Les 7 fichiers `k8s/*.yaml` validés contre le schéma Kubernetes réel avec `kubeconform`
  (binaire officiel v0.6.7, téléchargé et exécuté ici, mode `--strict`) : 9 ressources, toutes
  valides, zéro erreur.
- Les routes de sonde (`/api/v1/health`, `/`) et les ports (4000, 3000) confirmés directement
  contre `apps/api/Dockerfile`/`apps/web/Dockerfile`/`docker-compose.yml`, pas devinés.
- La liste de variables d'environnement de `01-configmap.yaml`/`02-secret.example.yaml` confirmée
  exhaustive par lecture directe du service `api`/`web` de `docker-compose.yml` (chaque variable
  qu'il définit a son équivalent ici, à l'exception de celles propres à la stack de démo locale -
  `DEMO_MODE`, `CLAMAV_HOST`/`CLAMAV_PORT` optionnels non repris par défaut, `.env.example`
  documente leur ajout si besoin).

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

Reste, pour aller au-delà de ce que ce document couvre : un chart Helm ou une configuration
Kustomize (les manifestes bruts ci-dessus suffisent pour un premier déploiement et restent la
référence la plus simple à auditer, mais ne gèrent pas nativement plusieurs environnements) ; un
`NetworkPolicy` restreignant le trafic entre pods ; l'intégration à un gestionnaire de secrets
réel plutôt que le gabarit `02-secret.example.yaml`.
