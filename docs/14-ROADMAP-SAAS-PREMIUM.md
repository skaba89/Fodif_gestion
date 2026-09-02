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
| B4 | SSO/OpenID Connect pour les agents publics. Décision prise : Keycloak — open source, auto-hébergeable, sans dépendance à un fournisseur cloud, standard OpenID Connect (n'importe quel autre IdP compatible OIDC fonctionnera aussi côté API sans changement) | **Fait** (cette itération) |
| B5 | Chiffrement au repos des données personnelles sensibles (au-delà du hachage des mots de passe et du chiffrement du secret MFA déjà en place) — **nécessite un gestionnaire de secrets/KMS en production** | À faire — décision d'infrastructure requise |
| B6 | Politique de rétention et purge des données, export/suppression sur demande (droits des personnes) | À faire |
| B7a | Dossier de déploiement d'un environnement de **test** (Render/Netlify + Neon/Supabase), en attendant le choix de l'hébergeur institutionnel définitif — `docs/15-DEPLOIEMENT-TEST.md` | **Fait** (cette itération) |
| B7b | Séparation réelle DEV / REC / PPD / PROD sur l'hébergeur institutionnel définitif (actuellement un seul `docker-compose.yml` de démonstration locale + l'environnement de test B7a) — **nécessite le choix d'un hébergeur/cloud cible** | À faire — décision requise |
| B8 | Revue de sécurité externe / test d'intrusion avant mise en production | À faire, en fin de parcours |
| B9 | Rendre fonctionnels tous les rôles prévus dans `docs/01-MVP.md` — `AUDITEUR` avait des permissions RBAC en base depuis le début (`audit.read`, `financing.read`, `impact.read`) mais aucune route API ne les vérifiait ni aucun portail web ne les exploitait ; `PARTENAIRE_BANCAIRE` restait sans surface API (voir axe D1) | **Fait** (cette itération, en deux temps : AUDITEUR puis PARTENAIRE_BANCAIRE via D1) |

## Axe C — Fiabilité & observabilité SaaS

| Phase | Contenu | Statut |
|---|---|---|
| C1 | Tests unitaires et e2e API (Jest + Supertest), invariants anti-régression pré-push | Fait |
| C2a | Tests e2e web (Playwright) : connexion, rejet de rôle, déconnexion, et le parcours TOTP complet (enrôlement puis vérification) — jusqu'ici jamais exercé de bout en bout dans un navigateur réel | **Fait** (cette itération) |
| C2b | Tests e2e web : dépôt de dossier PME, instruction agent, décision comité | À faire |
| C3a | Traces OpenTelemetry (HTTP, routes Express, requêtes PostgreSQL) et logs structurés JSON en production, corrélés par `traceId`/`spanId` — même schéma que B3 : `OTEL_SERVICE_NAME` existait déjà dans `.env.example` sans jamais être câblé | **Fait** (cette itération) |
| C3b | Métriques applicatives (latence, débit, taux d'erreur) — a un chevauchement naturel avec C4 (nécessite un consommateur : dashboard ou backend de métriques cible) | À faire |
| C4 | Tableau de bord d'exploitation (latence, taux d'erreur, santé des files d'attente) — **nécessite un backend d'observabilité cible (Grafana/Datadog/...)** | À faire — décision requise |
| C5 | Pagination et limites de charge sur les listes à fort volume (dossiers, notifications, audit) à mesure que le nombre de PME grandit | **Fait** (cette itération) |
| C6 | Sauvegardes PostgreSQL automatisées et testées (restauration), plan de reprise après sinistre | À faire — décision d'infrastructure requise |

Détails C3a (`apps/api/src/tracing.ts`, `apps/api/src/common/json-logger.service.ts`) :

- le traçage ne démarre que si `OTEL_EXPORTER_OTLP_ENDPOINT` (ou `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`) est renseigné — l'exportateur OTLP lit lui-même ces variables d'environnement standard, donc aucune surface de configuration supplémentaire à ajouter. Aucun changement de comportement ni tentative d'export réseau tant que la variable est absente : le développement local, la CI et la démo Docker restent inertes par défaut ;
- une fois activé, instrumente HTTP, les routes Express et les requêtes PostgreSQL (`instrumentation-http`/`-express`/`-pg`, choisies individuellement plutôt que le paquet `auto-instrumentations-node` complet, pour ne pas importer des dizaines de paquets d'instrumentation inutilisés) ;
- en production (`NODE_ENV=production`), les logs passent en JSON structuré (un objet par ligne) plutôt que le format coloré de développement, avec `traceId`/`spanId` de la trace active attachés à chaque ligne pour corréler un log à la requête/trace qui l'a produit.

## Axe D — Autres chantiers produit

| Phase | Contenu | Statut |
|---|---|---|
| D1 | API partenaires bancaires (le rôle `PARTENAIRE_BANCAIRE` existe déjà en base). Décision de modèle prise avec la Direction : un partenaire voit l'union de deux périmètres — les financements où il est désigné banque correspondante, et les PME de son propre portefeuille client — et s'authentifie comme tout autre compte (pas de sous-système de clé API séparé) | **Fait** (cette itération) |
| D2 | PWA installable et mode dégradé hors-ligne pour les agents en zone à connectivité limitée | À faire |
| D3 | Internationalisation (le contenu est actuellement en français uniquement, cohérent avec le contexte national — à revisiter seulement si un besoin multilingue apparaît) | À évaluer |
| D4 | Facturation / gestion multi-organisme si la plateforme est mutualisée au-delà du FODIP | À évaluer |

## Méthode

- Chaque phase marquée « décision requise » bloque sur un choix qui n'appartient pas à
  l'équipe technique seule (fournisseur SSO, hébergeur cible, outil d'observabilité) : à trancher
  avec la Direction avant implémentation plutôt que de figer un choix par défaut.
- Les phases sans dépendance externe (A1-A3, A5-A6, B6, B7a, B9, C1-C3a) peuvent démarrer sans
  attendre ces décisions.
- Chaque phase livrée suit la même discipline que le reste du dépôt : tests, `pnpm lint`,
  `pnpm test:prepush`, build API et web verts avant fusion.

Détails B4 (`apps/api/src/auth/oidc/`, `apps/web/app/api/session/oidc/`) :

- flux « Authorization Code + PKCE » standard OIDC, avec `state`/`nonce` et vérificateur PKCE
  générés à l'aller et vérifiés au retour (protection CSRF et rejeu) ; l'API reste sans état côté
  serveur (pas de Redis/session store) — ces éléments transitent dans un cookie `httpOnly` signé
  et à très courte durée de vie (`fodip_oidc_flow`, 10 min) plutôt que dans une session serveur ;
- **authentification, pas provisioning** : une identité OIDC valide doit correspondre à un compte
  déjà actif dans la base (`users.actif`) — aucune création de compte ni attribution de rôle
  automatique à la connexion. Un compte inconnu ou inactif est rejeté avec un message explicite ;
- le MFA TOTP existant n'est jamais contourné : si le compte résolu a `mfa_required`, le retour
  d'OIDC déclenche exactement le même challenge MFA que la connexion par mot de passe
  (`MfaService#beginChallenge`), avant l'émission du token de session final ;
- la redirection navigateur `/auth/oidc/callback` → page de connexion du portail ne transporte
  jamais le token de session final ni le secret TOTP dans l'URL, seulement un jeton de livraison
  opaque à usage unique et à très courte durée (2 min), échangé côté serveur (BFF) contre la
  session — analogue à un `authorization_code` OAuth ;
- désactivé par défaut : `OidcService#isEnabled()` exige les quatre variables
  `OIDC_ISSUER_URL`/`OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET`/`OIDC_REDIRECT_URI` ; en leur absence,
  `/auth/oidc/login` et `/auth/oidc/callback` répondent 404 et aucun bouton SSO n'apparaît côté
  web (voir `.env.example`). Le portail PME/entrepreneur ne propose pas le SSO (comptes externes,
  hors périmètre agents publics) ;
- vérification effectuée cette itération : suite de tests unitaires dédiée (mock du client OIDC),
  build et lint API/web propres, vérification visuelle du bouton SSO sur les quatre portails
  institutionnels et de son absence sur le portail PME. Aucun fournisseur d'identité OIDC réel
  (Keycloak ou autre) n'était disponible dans cet environnement d'exécution : le round-trip complet
  navigateur → IdP → callback n'a donc pas été exercé en conditions réelles et devra l'être avant
  mise en production.

Détails C5 (`apps/api/src/common/dto/pagination-query.dto.ts`, `apps/web/app/_shared/Pagination.tsx`) :

- `dossiers_financement` (files d'instruction agent et de décision comité) et `financements`
  (portefeuille Direction) sont les listes qui grandissent réellement avec le nombre de PME au
  fil des années — désormais paginées côté base (`LIMIT`/`OFFSET` + `COUNT(*) OVER()` pour
  obtenir le total en une seule requête, même motif SQL que la pagination agent déjà livrée
  précédemment) plutôt que de charger l'intégralité de la table à chaque affichage ;
- `page`/`limite` partagés via `PaginationQueryDto` (`limite` plafonnée à 100) pour éviter qu'un
  appelant ne force un scan non borné en demandant une page géante ;
- corrige au passage un bug latent sur `/agent/dossiers` : l'API paginait déjà (livré avec
  l'instruction agent), mais la page ne proposait aucun contrôle pour naviguer au-delà de la
  page 1 — un agent ne pouvait donc jamais voir un dossier au-delà des 25 premiers pour un
  statut donné. Le nouveau composant `Pagination` partagé corrige ce cas et est réutilisé sur les
  trois pages (agent, comité, direction) ;
- les listes qui restent non paginées (notifications — déjà bornées à 100 résultats côté requête ;
  dossiers PME d'une seule entreprise ; utilisateurs internes en administration) sont des
  ensembles naturellement bornés par construction (un compte, un portefeuille PME, l'effectif
  interne), pas des historiques croissant avec le volume de PME — hors périmètre de cette phase ;
  aucun endpoint de consultation des `audit_logs` n'existe encore côté API (table écrite mais
  jamais exposée en lecture), donc rien à paginer de ce côté pour l'instant ;
- les indicateurs agrégés (montants, compteurs par statut) affichés au-dessus de chaque tableau
  paginé sont désormais explicitement annotés « (page) » quand ils ne portent que sur la page
  affichée plutôt que sur l'ensemble filtré, pour ne pas laisser croire à un total global inexact.

Détails B9 (`apps/api/src/audit/`, `apps/web/app/auditeur/`) :

- diagnostic : `AuthorizationGuard` (`common/guards/authorization.guard.ts`) applique le contrôle
  de rôle et le contrôle de permission en ET — un compte `AUDITEUR` échouait donc systématiquement
  au contrôle de rôle des contrôleurs `financings`/`committee`/`agent-applications` avant même que
  ses permissions RBAC (`audit.read`, `financing.read`, `impact.read`, présentes en base depuis
  le tout premier commit RBAC) ne soient évaluées. Le rôle existait, était sélectionnable en
  administration et pouvait s'authentifier, mais n'avait accès à strictement aucune donnée ;
- `GET /audit/logs` (nouveau module `audit/`) expose enfin `audit_logs` en lecture, paginé
  (même motif que l'axe C5 : `LIMIT`/`OFFSET` + `COUNT(*) OVER()`), filtrable par `entityType`
  (liste fermée alignée sur les valeurs réellement écrites par chaque module) et `action` ;
- `AUDITEUR` ajouté à la liste de rôles autorisés de `FinancingsController` (lecture seule : les
  permissions `*.manage` requises par les routes de mutation restent absentes de son profil RBAC,
  donc ces routes lui restent fermées, sans changement de code supplémentaire) ;
- nouveau portail web `apps/web/app/auditeur/` (connexion + tableau de bord en lecture seule,
  réutilisant le composant `Pagination` de l'axe C5) et compte de démonstration
  `auditeur@fodip.local` (`database/seeds/002_analytics_demo.sql`) ; SSO (axe B4) étendu à ce
  cinquième portail (`OIDC_PORTALS`) pour rester cohérent avec les quatre autres portails
  institutionnels ;
- `PARTENAIRE_BANCAIRE`, contrairement à `AUDITEUR`, ne se limitait pas à un contrôle de rôle
  manquant : aucun modèle de données ne reliait un partenaire bancaire à un sous-ensemble de
  dossiers/financements. Plutôt que d'improviser ce schéma, la décision de modèle a été soumise à
  la Direction avant implémentation — voir détails D1 ci-dessous.

Détails D1 (`database/011_partner_banks.sql`, `apps/api/src/partner/`, `apps/web/app/partenaire/`) :

- décision de modèle (validée avec la Direction) : le périmètre visible d'un partenaire est
  l'union de deux mécanismes indépendants plutôt qu'un lien unique tout-ou-rien —
  1. **banque correspondante** : un financement peut désigner une banque partenaire chargée
     d'exécuter réellement ses décaissements/remboursements pour le compte du FODIP et de les
     déclarer a posteriori (`financements.banque_partenaire_id`) — le FODIP garde la décision de
     financement, la banque exécute et déclare ;
  2. **portefeuille client** : un partenaire peut aussi voir les PME avec lesquelles il a déjà une
     relation commerciale (`partenaire_entreprises`), indépendamment de qui exécute le paiement
     sur l'un de leurs financements ;
  - authentification : décision déléguée, choix retenu — même connexion email/mot de passe + JWT
    que tous les autres comptes plutôt qu'un sous-système de clé API séparé (rotation, révocation,
    audit dédiés) qui aurait constitué un chantier de sécurité à part entière ;
- `GET /partner/financings`, `GET /partner/financings/:id`, `POST /partner/financings/:id/disbursements`,
  `POST /partner/financings/:id/repayments` — chaque requête est scopée en base par le
  `partenaire_bancaire_id` de l'appelant (jamais par un identifiant transmis par le client) ; un
  financement hors périmètre renvoie 404, jamais 403, pour ne pas révéler son existence — même
  principe d'anti-énumération que l'isolation PME (`applications`/`companies` controllers) ;
- contrairement au flux Direction (planifier puis exécuter), un partenaire déclare un paiement
  déjà effectué en une seule étape (`decaissements`/`remboursements` insérés directement en statut
  `EFFECTUE`), validé par la même politique `finance-policy.js#validateAvailableAmount` que le
  flux interne ; la vue détail d'un financement exposée à un partenaire omet volontairement
  `impact` (reporting interne au FODIP) et `audit` (identités des agents FODIP) ;
- `admin-policy.js#validateUserScope` exige désormais un `partenaireBancaireId` pour tout compte
  `PARTENAIRE_BANCAIRE`, même principe que `PME_ENTERPRISE_SCOPE_REQUIRED` pour un compte PME ;
  l'administration peut affecter une banque partenaire à un compte via un nouveau sélecteur
  (`GET /administration/partner-banks`), mais les fiches `partenaires_bancaires` elles-mêmes sont
  provisionnées par SQL, exactement comme les `entreprises` PME le sont déjà aujourd'hui (aucun
  des deux n'a de flux de création en libre-service côté API) ;
- nouveau portail web `apps/web/app/partenaire/` (connexion, portefeuille paginé, détail avec
  formulaires de déclaration) — volontairement sans lien SSO (axe B4) : un partenaire bancaire est
  un tiers externe, pas un agent public, donc hors du périmètre de l'IdP institutionnel ; compte
  de démonstration `partenaire@fodip.local` exerçant les deux mécanismes de périmètre
  (`database/seeds/003_partner_bank_demo.sql`).
