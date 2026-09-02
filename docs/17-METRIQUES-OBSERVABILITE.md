# Étape 14d — Métriques applicatives et tableau de bord d'exploitation (axes C3b/C4)

## Objectif et périmètre

Axes **C3b** et **C4** de `docs/14-ROADMAP-SAAS-PREMIUM.md` : métriques applicatives (latence,
débit, taux d'erreur) et un tableau de bord d'exploitation qui les lit. C4 précisait « nécessite
un backend d'observabilité cible (Grafana/Datadog/...) » — décision prise dans le même esprit que
B4 (Keycloak) : auto-hébergé, open source, sans dépendance à un fournisseur cloud ni engagement de
coût, cohérent avec le reste de la pile Docker Compose du dépôt. **Prometheus + Grafana**, tous
deux ajoutés à `docker-compose.yml` derrière le profil `observability` — complètement absents
d'un `docker compose up` normal (donc de la CI, qui n'active jamais de profil), démarrés
uniquement sur demande.

## Le mécanisme

- **`apps/api/src/metrics/`** — `GET /api/v1/metrics` expose les métriques au format
  d'exposition Prometheus (`prom-client`), en accès public comme `/health` (Prometheus ne porte
  jamais de jeton d'authentification). Un histogramme unique,
  `fodip_api_http_request_duration_seconds`, étiqueté par méthode, route (le **motif** de route
  associé par Nest, jamais l'URL brute — sinon chaque identifiant/UUID créerait sa propre série,
  l'erreur de cardinalité que la documentation Prometheus met explicitement en garde) et code de
  statut, enregistré par un middleware global qui lit `response.statusCode` et `request.route`
  seulement dans l'événement `finish` de la réponse — après que le filtre d'exceptions global a
  eu l'occasion de fixer le code de statut réel, pas avant. Les métriques par défaut de Node.js
  (CPU, mémoire, latence de la boucle d'événements, GC) sont collectées sur le même registre.
  Aucune file d'attente/job en arrière-plan n'existe dans ce dépôt à ce jour, donc le volet « santé
  des files d'attente » du libellé original de C4 ne s'applique simplement pas encore ici.
- **`monitoring/prometheus.yml`** — configuration de scrutation, cible `api:4000/api/v1/metrics`
  (le nom de service Docker Compose, comme pour PostgreSQL/MinIO).
- **`monitoring/grafana/`** — provisionnement automatique : la source de données Prometheus et un
  tableau de bord (`dashboards/fodip-api.json`) sont déjà présents à l'ouverture de Grafana, rien à
  recréer manuellement. Sept panneaux : débit par route, latence p95 par route, taux d'erreur
  5xx, débit total, latence de la boucle d'événements, utilisation CPU, mémoire résidente.

## Utilisation

```bash
docker compose --profile observability up --detach
# Grafana : http://localhost:3001 (admin / fodip_local_admin par défaut - GRAFANA_ADMIN_PASSWORD à changer)
# Prometheus : http://localhost:9090
```

## Vérifié

Contrairement à la plupart des vérifications Docker de ce dépôt, celle-ci a pu être faite
directement plutôt que déduite du code, PostgreSQL et Prometheus étant tous deux installables sans
Docker dans l'environnement où ce travail a été préparé :

- l'API réelle (compilée, lancée en local contre un vrai PostgreSQL migré et seedé) a servi
  `/api/v1/metrics` avec un format d'exposition valide, vérifié par `promtool check metrics`
  (l'outil de lint officiel de Prometheus) pour la métrique applicative propre à ce dépôt ;
- un vrai binaire `prometheus`, configuré avec `monitoring/prometheus.yml` (juste la cible
  ajustée pour l'environnement local), a scruté cette API avec succès (`"health": "up"`) ;
- les trois requêtes PromQL utilisées dans le tableau de bord (débit par route, latence p95 par
  route, taux d'erreur) ont été exécutées contre ce Prometheus réel et retournent les valeurs
  attendues ;
- `docker compose config --quiet` et `python3 scripts/check-docker.py` valident la syntaxe
  Compose ; `docker compose config --services` confirme que `prometheus`/`grafana` sont bien
  absents sans le profil `observability` et présents avec.

Seul le rendu du tableau de bord dans Grafana lui-même n'a pas pu être vérifié directement (paquet
non disponible sans le dépôt APT officiel de Grafana, hors de la politique réseau de cet
environnement) — le JSON suit le schéma Grafana standard et référence les mêmes requêtes déjà
confirmées correctes contre Prometheus.
