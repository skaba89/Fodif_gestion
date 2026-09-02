# Étape 14 — Feuille de route « plateforme étatique, moderne, SaaS entreprise premium »

## Objectif

Faire passer FODIP Digital 2030 d'un MVP fonctionnel à une plateforme perçue et opérée comme un
produit SaaS d'entreprise de premier plan, digne d'un déploiement institutionnel national :
identité visuelle soignée, fiabilité opérationnelle mesurable, conformité et sécurité de niveau
étatique. Ce document découpe l'ambition en quatre axes indépendants, chacun en phases livrables
séparément, pour permettre un avancement continu sans big-bang.

## Axe A — Identité visuelle & design system

| Phase | Contenu | Statut |
|---|---|---|
| A1 | Jetons de design (couleurs, typographie, espacements, ombres, mode sombre) centralisés dans `globals.css`, typographie institutionnelle auto-hébergée (Public Sans, la même famille que le design system gouvernemental américain USWDS — professionnelle, très lisible, gratuite) | **Fait** (cette itération) |
| A2 | Refonte des composants partagés (boutons, cartes, tableaux, badges de statut, formulaires) avec états `:hover`/`:focus-visible`/`:disabled` cohérents, échelle d'élévation | **Fait** (cette itération) |
| A3 | Page d'accueil : remplacement de la redirection brute vers `/direction/tableau-de-bord` par un sélecteur de portail explicite | **Fait** (cette itération) |
| A4 | Bascule thème clair/sombre manuelle persistée (au-delà du `prefers-color-scheme` automatique livré en A1) | À faire |
| A5 | Bibliothèque de composants documentée (Storybook ou équivalent léger) pour garder la cohérence à mesure que l'équipe grandit | À faire |
| A6 | Accessibilité WCAG 2.1 AA : audit contrastes, navigation clavier complète, lecteurs d'écran sur les tableaux et formulaires complexes (scoring, décision comité) | À faire |

## Axe B — Conformité & sécurité de niveau étatique

| Phase | Contenu | Statut |
|---|---|---|
| B1 | RBAC fin, JWT, hachage bcrypt, isolation multi-tenant PME testée en e2e | Fait (MVP initial) |
| B2 | Rate limiting, `helmet`, filtre d'exceptions global (pas de fuite d'erreur interne), MFA TOTP fonctionnel | **Fait** (PR #12) |
| B3 | MFA imposé (non simplement proposé) pour les rôles sensibles — le code prévoyait déjà `admin-policy.js#requiresMfa`/`PRIVILEGED_ROLES` (`SUPER_ADMIN`, `DIRECTION_FODIP`, `AGENT_FODIP`, `ANALYSTE`, `COMITE_FINANCEMENT`, `AUDITEUR`) mais la fonction n'était jamais appelée | **Fait** (cette itération) |
| B4 | SSO/SAML ou OpenID Connect pour les agents publics (fédération avec un IdP gouvernemental) — **nécessite de choisir un fournisseur d'identité avant de démarrer** | À faire — décision requise |
| B5 | Chiffrement au repos des données personnelles sensibles (au-delà du hachage des mots de passe et du chiffrement du secret MFA déjà en place) — **nécessite un gestionnaire de secrets/KMS en production** | À faire — décision d'infrastructure requise |
| B6 | Politique de rétention et purge des données, export/suppression sur demande (droits des personnes) | À faire |
| B7 | Séparation réelle DEV / REC / PPD / PROD (actuellement un seul `docker-compose.yml` de démonstration locale) — **nécessite le choix d'un hébergeur/cloud cible** | À faire — décision requise |
| B8 | Revue de sécurité externe / test d'intrusion avant mise en production | À faire, en fin de parcours |

## Axe C — Fiabilité & observabilité SaaS

| Phase | Contenu | Statut |
|---|---|---|
| C1 | Tests unitaires et e2e API (Jest + Supertest), invariants anti-régression pré-push | Fait |
| C2a | Tests e2e web (Playwright) : connexion, rejet de rôle, déconnexion, et le parcours TOTP complet (enrôlement puis vérification) — jusqu'ici jamais exercé de bout en bout dans un navigateur réel | **Fait** (cette itération) |
| C2b | Tests e2e web : dépôt de dossier PME, instruction agent, décision comité | À faire |
| C3a | Traces OpenTelemetry (HTTP, routes Express, requêtes PostgreSQL) et logs structurés JSON en production, corrélés par `traceId`/`spanId` — même schéma que B3 : `OTEL_SERVICE_NAME` existait déjà dans `.env.example` sans jamais être câblé | **Fait** (cette itération) |
| C3b | Métriques applicatives (latence, débit, taux d'erreur) — a un chevauchement naturel avec C4 (nécessite un consommateur : dashboard ou backend de métriques cible) | À faire |
| C4 | Tableau de bord d'exploitation (latence, taux d'erreur, santé des files d'attente) — **nécessite un backend d'observabilité cible (Grafana/Datadog/...)** | À faire — décision requise |
| C5 | Pagination et limites de charge sur les listes à fort volume (dossiers, notifications, audit) à mesure que le nombre de PME grandit | À faire |
| C6 | Sauvegardes PostgreSQL automatisées et testées (restauration), plan de reprise après sinistre | À faire — décision d'infrastructure requise |

Détails C3a (`apps/api/src/tracing.ts`, `apps/api/src/common/json-logger.service.ts`) :

- le traçage ne démarre que si `OTEL_EXPORTER_OTLP_ENDPOINT` (ou `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`) est renseigné — l'exportateur OTLP lit lui-même ces variables d'environnement standard, donc aucune surface de configuration supplémentaire à ajouter. Aucun changement de comportement ni tentative d'export réseau tant que la variable est absente : le développement local, la CI et la démo Docker restent inertes par défaut ;
- une fois activé, instrumente HTTP, les routes Express et les requêtes PostgreSQL (`instrumentation-http`/`-express`/`-pg`, choisies individuellement plutôt que le paquet `auto-instrumentations-node` complet, pour ne pas importer des dizaines de paquets d'instrumentation inutilisés) ;
- en production (`NODE_ENV=production`), les logs passent en JSON structuré (un objet par ligne) plutôt que le format coloré de développement, avec `traceId`/`spanId` de la trace active attachés à chaque ligne pour corréler un log à la requête/trace qui l'a produit.

## Axe D — Autres chantiers produit

| Phase | Contenu | Statut |
|---|---|---|
| D1 | API publique partenaires bancaires documentée (le rôle `PARTENAIRE_BANCAIRE` existe déjà en base) | À faire |
| D2 | PWA installable et mode dégradé hors-ligne pour les agents en zone à connectivité limitée | À faire |
| D3 | Internationalisation (le contenu est actuellement en français uniquement, cohérent avec le contexte national — à revisiter seulement si un besoin multilingue apparaît) | À évaluer |
| D4 | Facturation / gestion multi-organisme si la plateforme est mutualisée au-delà du FODIP | À évaluer |

## Méthode

- Chaque phase marquée « décision requise » bloque sur un choix qui n'appartient pas à
  l'équipe technique seule (fournisseur SSO, hébergeur cible, outil d'observabilité) : à trancher
  avec la Direction avant implémentation plutôt que de figer un choix par défaut.
- Les phases sans dépendance externe (A1-A3, A5-A6, B6, C1-C3a, C5) peuvent démarrer sans
  attendre ces décisions.
- Chaque phase livrée suit la même discipline que le reste du dépôt : tests, `pnpm lint`,
  `pnpm test:prepush`, build API et web verts avant fusion.
