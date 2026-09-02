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
| B3 | MFA obligatoire par défaut pour les rôles `SUPER_ADMIN` et `DIRECTION_FODIP` (actuellement optionnel par utilisateur) | À faire |
| B4 | SSO/SAML ou OpenID Connect pour les agents publics (fédération avec un IdP gouvernemental) — **nécessite de choisir un fournisseur d'identité avant de démarrer** | À faire — décision requise |
| B5 | Chiffrement au repos des données personnelles sensibles (au-delà du hachage des mots de passe et du chiffrement du secret MFA déjà en place) — **nécessite un gestionnaire de secrets/KMS en production** | À faire — décision d'infrastructure requise |
| B6 | Politique de rétention et purge des données, export/suppression sur demande (droits des personnes) | À faire |
| B7 | Séparation réelle DEV / REC / PPD / PROD (actuellement un seul `docker-compose.yml` de démonstration locale) — **nécessite le choix d'un hébergeur/cloud cible** | À faire — décision requise |
| B8 | Revue de sécurité externe / test d'intrusion avant mise en production | À faire, en fin de parcours |

## Axe C — Fiabilité & observabilité SaaS

| Phase | Contenu | Statut |
|---|---|---|
| C1 | Tests unitaires et e2e API (Jest + Supertest), invariants anti-régression pré-push | Fait |
| C2 | Tests e2e web (Playwright) sur les parcours critiques : connexion (y compris MFA), dépôt de dossier PME, instruction agent, décision comité | À faire |
| C3 | Instrumentation OpenTelemetry (déjà prévue dans `.env.example` via `OTEL_SERVICE_NAME`, non câblée) : traces, métriques, logs structurés | À faire |
| C4 | Tableau de bord d'exploitation (latence, taux d'erreur, santé des files d'attente) — **nécessite un backend d'observabilité cible (Grafana/Datadog/...)** | À faire — décision requise |
| C5 | Pagination et limites de charge sur les listes à fort volume (dossiers, notifications, audit) à mesure que le nombre de PME grandit | À faire |
| C6 | Sauvegardes PostgreSQL automatisées et testées (restauration), plan de reprise après sinistre | À faire — décision d'infrastructure requise |

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
- Les phases sans dépendance externe (A1-A3, A5-A6, B3, B6, C1-C3, C5) peuvent démarrer sans
  attendre ces décisions.
- Chaque phase livrée suit la même discipline que le reste du dépôt : tests, `pnpm lint`,
  `pnpm test:prepush`, build API et web verts avant fusion.
