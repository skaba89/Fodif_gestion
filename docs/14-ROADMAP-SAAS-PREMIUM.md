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
| A4 | Bascule thème clair/sombre manuelle persistée (au-delà du `prefers-color-scheme` automatique livré en A1) | **Fait** (cette itération) |
| A5 | Bibliothèque de composants documentée (Storybook ou équivalent léger) pour garder la cohérence à mesure que l'équipe grandit | **Fait** (cette itération) — équivalent léger : `/design-system` |
| A6 | Accessibilité WCAG 2.1 AA : audit contrastes, navigation clavier complète, lecteurs d'écran sur les tableaux et formulaires complexes (scoring, décision comité) | **Fait** (cette itération) — étiquettes de formulaire, contrastes, navigation clavier (liens d'évitement) et scan automatisé WCAG 2.1 A/AA en e2e ; reste un point : aucun test avec un lecteur d'écran réel (NVDA/JAWS/VoiceOver), aucun n'étant disponible dans cet environnement |

## Axe B — Conformité & sécurité de niveau étatique

| Phase | Contenu | Statut |
|---|---|---|
| B1 | RBAC fin, JWT, hachage bcrypt, isolation multi-tenant PME testée en e2e | Fait (MVP initial) |
| B2 | Rate limiting, `helmet`, filtre d'exceptions global (pas de fuite d'erreur interne), MFA TOTP fonctionnel | **Fait** (PR #12) |
| B3 | MFA imposé (non simplement proposé) pour les rôles sensibles — le code prévoyait déjà `admin-policy.js#requiresMfa`/`PRIVILEGED_ROLES` (`SUPER_ADMIN`, `DIRECTION_FODIP`, `AGENT_FODIP`, `ANALYSTE`, `COMITE_FINANCEMENT`, `AUDITEUR`) mais la fonction n'était jamais appelée | **Fait** (cette itération) |
| B4 | SSO/OpenID Connect pour les agents publics. Décision prise : Keycloak — open source, auto-hébergeable, sans dépendance à un fournisseur cloud, standard OpenID Connect (n'importe quel autre IdP compatible OIDC fonctionnera aussi côté API sans changement) | **Fait** (cette itération) |
| B5 | Chiffrement au repos des données personnelles sensibles (au-delà du hachage des mots de passe et du chiffrement du secret MFA déjà en place) — **nécessite un gestionnaire de secrets/KMS en production** | **Partiel** (cette itération) — mécanisme et premier champ (téléphone) chiffrés ; la garde de la clé en production (sauvegarde, rotation, KMS) reste liée à la décision d'hébergement (B7b) |
| B6 | Politique de rétention et purge des données, export/suppression sur demande (droits des personnes) | **Partiel** (cette itération) — export et effacement sur demande faits ; purge automatique par durée de rétention en attente d'une décision juridique |
| B7a | Dossier de déploiement d'un environnement de **test** (Render/Netlify + Neon/Supabase), en attendant le choix de l'hébergeur institutionnel définitif — `docs/15-DEPLOIEMENT-TEST.md` | **Fait** (cette itération) |
| B7b | Séparation réelle DEV / REC / PPD / PROD sur l'hébergeur institutionnel définitif (actuellement un seul `docker-compose.yml` de démonstration locale + l'environnement de test B7a) — **nécessite le choix d'un hébergeur/cloud cible** | À faire — décision requise |
| B8 | Revue de sécurité externe / test d'intrusion avant mise en production | À faire, en fin de parcours |
| B9 | Rendre fonctionnels tous les rôles prévus dans `docs/01-MVP.md` — `AUDITEUR` avait des permissions RBAC en base depuis le début (`audit.read`, `financing.read`, `impact.read`) mais aucune route API ne les vérifiait ni aucun portail web ne les exploitait ; `PARTENAIRE_BANCAIRE` restait sans surface API (voir axe D1) | **Fait** (cette itération, en deux temps : AUDITEUR puis PARTENAIRE_BANCAIRE via D1) |

## Axe C — Fiabilité & observabilité SaaS

| Phase | Contenu | Statut |
|---|---|---|
| C1 | Tests unitaires et e2e API (Jest + Supertest), invariants anti-régression pré-push | Fait |
| C2a | Tests e2e web (Playwright) : connexion, rejet de rôle, déconnexion, et le parcours TOTP complet (enrôlement puis vérification) — jusqu'ici jamais exercé de bout en bout dans un navigateur réel | **Fait** (cette itération) |
| C2b | Tests e2e web : dépôt de dossier PME, instruction agent, décision comité | **Fait** (cette itération) |
| C3a | Traces OpenTelemetry (HTTP, routes Express, requêtes PostgreSQL) et logs structurés JSON en production, corrélés par `traceId`/`spanId` — même schéma que B3 : `OTEL_SERVICE_NAME` existait déjà dans `.env.example` sans jamais être câblé | **Fait** (cette itération) |
| C3b | Métriques applicatives (latence, débit, taux d'erreur) — a un chevauchement naturel avec C4 (nécessite un consommateur : dashboard ou backend de métriques cible) | **Fait** (cette itération) |
| C4 | Tableau de bord d'exploitation (latence, taux d'erreur, santé des files d'attente) — **nécessite un backend d'observabilité cible (Grafana/Datadog/...)** | **Fait** (cette itération) — Prometheus + Grafana auto-hébergés (`docs/17-METRIQUES-OBSERVABILITE.md`) |
| C5 | Pagination et limites de charge sur les listes à fort volume (dossiers, notifications, audit) à mesure que le nombre de PME grandit | **Fait** (cette itération) |
| C6 | Sauvegardes PostgreSQL automatisées et testées (restauration), plan de reprise après sinistre | **Partiel** (cette itération) — mécanisme de sauvegarde/restauration construit et testé en continu par la CI (`docs/16-SAUVEGARDES-RESTAURATION.md`) ; planification, réplication hors site et objectifs RPO/RTO restent liés à la décision d'hébergement (B7b) |

Détails C3a (`apps/api/src/tracing.ts`, `apps/api/src/common/json-logger.service.ts`) :

- le traçage ne démarre que si `OTEL_EXPORTER_OTLP_ENDPOINT` (ou `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`) est renseigné — l'exportateur OTLP lit lui-même ces variables d'environnement standard, donc aucune surface de configuration supplémentaire à ajouter. Aucun changement de comportement ni tentative d'export réseau tant que la variable est absente : le développement local, la CI et la démo Docker restent inertes par défaut ;
- une fois activé, instrumente HTTP, les routes Express et les requêtes PostgreSQL (`instrumentation-http`/`-express`/`-pg`, choisies individuellement plutôt que le paquet `auto-instrumentations-node` complet, pour ne pas importer des dizaines de paquets d'instrumentation inutilisés) ;
- en production (`NODE_ENV=production`), les logs passent en JSON structuré (un objet par ligne) plutôt que le format coloré de développement, avec `traceId`/`spanId` de la trace active attachés à chaque ligne pour corréler un log à la requête/trace qui l'a produit.

## Axe D — Autres chantiers produit

| Phase | Contenu | Statut |
|---|---|---|
| D1 | API partenaires bancaires (le rôle `PARTENAIRE_BANCAIRE` existe déjà en base). Décision de modèle prise avec la Direction : un partenaire voit l'union de deux périmètres — les financements où il est désigné banque correspondante, et les PME de son propre portefeuille client — et s'authentifie comme tout autre compte (pas de sous-système de clé API séparé) | **Fait** (cette itération) |
| D2 | PWA installable et mode dégradé hors-ligne pour les agents en zone à connectivité limitée | **Fait** (cette itération) — manifeste, icônes, service worker et page de repli (`docs/18-PWA-HORS-LIGNE.md`) |
| D3 | Internationalisation (le contenu est actuellement en français uniquement, cohérent avec le contexte national — à revisiter seulement si un besoin multilingue apparaît) | À évaluer |
| D4 | Facturation / gestion multi-organisme si la plateforme est mutualisée au-delà du FODIP | À évaluer |

## Axe E — Sprint Enterprise 0 (SaaS entreprise critique)

Mission distincte des axes A-D ci-dessus : faire mûrir la gouvernance, les tests, l'UI/UX,
l'identité/sécurité, l'intégrité financière, la gestion documentaire et l'architecture Docker au
niveau attendu d'un SaaS entreprise critique, en petits lots indépendants (une PR par lot,
jamais une transformation géante). Détail par lot dans son propre document une fois livré.

| Phase | Contenu | Statut |
|---|---|---|
| E1 | Gouvernance GitHub et supply chain : CODEOWNERS, template de PR, `SECURITY.md`, Dependabot, CodeQL, scan de secrets, audit de licences, CI parallélisée et durcie (lockfile figé, Actions épinglées par SHA), vulnérabilité lodash corrigée | **Fait** (cette itération) — `docs/19-GOUVERNANCE-SUPPLY-CHAIN.md` |
| E2 | Tests entreprise : intégration réelle PostgreSQL/MinIO, priorité aux modules financiers critiques, matrice Playwright multi-navigateurs/mobile, régression visuelle | **Partiel** (cette itération) — `docs/20-TESTS-ENTREPRISE.md` : les quatre modules métier critiques (`financings`, `committee`, `administration`, `partner`) couverts contre un vrai PostgreSQL (verrouillage de lignes, contrainte unique, `UPDATE` conditionnel, verrou consultatif global, isolation entre banques partenaires, double-soumission concurrente) ; MinIO et la matrice Playwright restent à faire |
| E3 | Refonte UI/UX ultra premium : design system partagé, navigation mobile, états de chargement/erreur/vide systématiques, assistants PME/Agent/Comité/Direction | À faire |
| E4 | Identité et sécurité entreprise : cycle de vie de session complet, révocation, rate limiting distribué, durcissement OIDC, séparation et rotation des clés | À faire |
| E5 | Intégrité financière : idempotency keys, maker-checker, rapprochement bancaire, verrouillage optimiste, contraintes PostgreSQL sur montants/statuts | À faire |
| E6 | Documents entreprise : antivirus, quarantaine, checksum, versioning, upload en streaming | À faire |
| E7 | Architecture Docker entreprise : profils dédiés, images non-root avec healthchecks, SBOM signé, cible de production OCI/K8s documentée sans dépendance cloud | À faire |
| E8 | Multi-tenance réelle (organisations multiples) | Décision requise — ne pas migrer le modèle de données sans validation explicite du périmètre cible (FODIP seul, programmes internes multiples, ou plusieurs organismes indépendants) |

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

Détails A6 (partiel) et C2b (`apps/web/e2e/workflow.spec.ts`) :

- en préparant le test e2e du cycle complet (dépôt → instruction → décision), un défaut
  d'accessibilité systémique est apparu dans le dépôt : 19 champs de formulaire répartis sur 8
  pages utilisaient un `<label>Texte</label>` simplement adjacent au champ (`<input>`/`<select>`/
  `<textarea>`) plutôt qu'associé par `htmlFor`/`id` ou par imbrication — visuellement identique à
  un champ correctement étiqueté, mais sans lien programmatique : un lecteur d'écran ne peut pas
  annoncer le nom du champ, et un outil comme `getByLabel` de Playwright ne peut pas le cibler.
  Plusieurs contrôles (le sélecteur de décision d'instruction agent, le formulaire de notation du
  scoring, le sélecteur de décision comité) n'avaient même aucune étiquette du tout, uniquement un
  `placeholder` ou un texte visuel voisin. Tous ces cas sont corrigés (`htmlFor`/`id` pour les
  champs statiques, `aria-label` pour les champs générés dynamiquement par critère de scoring) —
  c'est un défaut WCAG 1.3.1/3.3.2/4.1.2 réel et vérifiable, corrigé sur l'ensemble du dépôt, mais
  ce n'est qu'une des exigences de l'axe A6 : contrastes de couleur, navigation clavier complète
  (ordre de tabulation, pièges au clavier) et tests avec un lecteur d'écran réel restent à faire ;
- `apps/web/e2e/workflow.spec.ts` exerce pour la première fois le cycle métier central de bout en
  bout dans un navigateur réel plutôt que par portail isolé (`login.spec.ts`/`mfa.spec.ts`
  couvraient déjà chaque portail séparément) : une PME dépose et soumet un dossier, un agent le
  prend en charge, note les 4 critères du modèle de scoring actif et le transmet au comité, le
  comité l'approuve, puis la PME voit son dossier passer à `APPROUVE` — verrouillant en une seule
  fois la régression sur l'intégralité de la chaîne de décision ;
- comme pour `login.spec.ts`/`mfa.spec.ts`, ce test nécessite la pile complète (web + API +
  PostgreSQL + MinIO, `docker compose up`) ; aucun démon Docker n'était disponible dans cet
  environnement d'exécution (vérifié : le CLI Docker est présent mais `dockerd` ne démarre pas
  dans ce bac à sable) pour l'exécuter réellement ici. Vérifié à la place : `pnpm lint`, `npx tsc
  --noEmit`, `npx playwright test --list` (le fichier est syntaxiquement valide et découvert par
  Playwright), et une relecture manuelle de chaque assertion contre le code des pages et des
  contrôleurs concernés (formats `NUMERIC` Postgres, permissions requises, transitions de statut).
  La CI (`.github/workflows`) dispose d'un vrai Docker et devra confirmer l'exécution réelle.

Détails A4 (`apps/web/app/_shared/ThemeToggle.tsx`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx`) :

- deux déclencheurs coexistent sur les mêmes jetons de conception : le `prefers-color-scheme`
  automatique livré en A1 reste le comportement par défaut, mais un choix explicite le
  prime dans les deux sens — `:root[data-theme="dark"]` force le sombre même si le système est en
  clair, et `:root:not([data-theme="light"])` dans la media query empêche le sombre automatique
  de s'appliquer si le visiteur a explicitement choisi le clair ;
- le choix est persisté dans `localStorage` (`fodip-theme`) et appliqué comme attribut
  `data-theme` sur `<html>` — jamais de cookie, jamais d'aller-retour serveur ;
- pour éviter un flash du mauvais thème puis correction (l'écueil classique de ce genre de
  bascule), un script inline synchrone dans `<head>` (`layout.tsx`) lit `localStorage` et pose
  l'attribut *avant* la première peinture, donc avant même l'hydratation React — d'où le
  `suppressHydrationWarning` sur `<html>`, le remède documenté pour ce décalage attendu entre le
  balisage rendu côté serveur (qui ignore la préférence du visiteur) et le DOM réel ;
- le bouton (☀️/🌙, `aria-label` explicite) est ajouté à l'en-tête des sept portails
  (entrepreneur, agent, comité, direction, administration, auditeur, partenaire), de la page
  d'accueil et du centre de notifications ;
- vérifié visuellement (captures Playwright locales, build de production) : bascule immédiate,
  persistance confirmée après rechargement (`data-theme` toujours présent, aucun flash), et
  cohérence sur une page tierce (connexion agent) sans revisiter la page d'accueil au préalable —
  le thème choisi s'applique dès le premier chargement sur n'importe quelle page grâce au script
  inline.

Détails B6, partiel (`database/012_data_rights.sql`, `apps/api/src/data-rights/`, `apps/web/app/mes-donnees/`) :

- l'axe B6 recouvre en réalité deux décisions distinctes, et une seule relève de l'ingénierie.
  Combien de temps chaque catégorie de donnée doit être conservée (dossiers de financement,
  journal d'audit...) avant purge automatique est un fait juridique propre au droit guinéen, pas
  un choix technique — inventer une durée serait pire que de laisser la question explicitement
  ouverte. Cette itération construit donc uniquement le volet « droits des personnes » (export et
  effacement sur demande), et documente la purge automatique par durée de rétention comme
  bloquée sur cette décision juridique plutôt que de l'ignorer silencieusement ;
- **export** : `GET /data-rights/export` (aucun décorateur `@RequireRoles`/`@RequirePermissions` —
  accessible à tout compte authentifié, quel que soit son rôle, via le comportement par défaut
  d'`AuthorizationGuard`) assemble tout ce que la plateforme détient sur le compte appelant : son
  profil, et, pour un compte PME (présence d'`entrepriseId`), les informations de l'entreprise, ses
  dirigeants et ses dossiers de financement — un compte agent FODIP, comité, partenaire bancaire ou
  auditeur n'a pas d'`entrepriseId`, ces sections sont alors simplement omises plutôt que devinées
  hors périmètre. Chaque export est journalisé (`audit_logs`, action `DATA_EXPORT`). Côté web,
  `/mes-donnees` (lien ajouté à la navigation des sept portails) déclenche le téléchargement d'un
  fichier JSON horodaté ;
- **effacement sur demande** : l'application n'a ni inscription en libre-service ni objet « ticket
  de demande » formel — comme la création de compte (déjà provisionnée par un SUPER_ADMIN), une
  demande d'effacement arrive hors ligne (canal de support, courrier) et un SUPER_ADMIN la
  traite via `POST /data-rights/users/:id/anonymize` (`@RequireRoles('SUPER_ADMIN')` +
  `@RequirePermissions('user.manage')`, bouton « Anonymiser » dans
  `apps/web/app/administration/utilisateurs/`). L'opération écrase `nom`/`prenom`/`telephone`/
  `email` par un repère non identifiant, désactive le compte (`actif = FALSE`) et pose
  `anonymized_at` — mais ne touche ni `dossiers_financement`, ni `financements`, ni `audit_logs` :
  ces tables référencent le compte uniquement par UUID et portent la trace financière/d'audit que
  l'établissement doit conserver, pas des données personnelles du titulaire. Une seconde tentative
  sur un compte déjà traité échoue explicitement (`ALREADY_ANONYMIZED`) plutôt que de ré-écraser
  silencieusement ;
- même protection que la désactivation de compte (`canDeactivateUser`, déjà utilisé par
  `administration.repository.ts#update`) : un SUPER_ADMIN ne peut ni s'auto-anonymiser, ni
  anonymiser le dernier SUPER_ADMIN actif — réutilisé tel quel plutôt que dupliqué ; même verrou
  consultatif Postgres (`pg_advisory_xact_lock(80913001)`) que la désactivation, puisque les deux
  mutent la même ligne `utilisateurs` et ne doivent pas s'entrelacer ; email de remplacement
  déterministe (`anonymise+<id>@fodip.invalid`) pour ne jamais entrer en collision avec la
  contrainte `UNIQUE` sur `utilisateurs.email` lors d'anonymisations successives ;
- migration additive uniquement (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS anonymized_at`,
  15ᵉ migration validée par `scripts/check-migrations.py`) ; `DataRightsRepository` écrit ses
  propres requêtes plutôt que d'importer `CompaniesRepository`/`ApplicationsRepository` (aucun des
  deux modules n'exporte son repository — même choix que pour `PartnerRepository` à l'axe D1) ;
- reste à faire pour clore complètement B6 : la décision juridique sur les durées de rétention par
  catégorie de donnée, puis la purge automatique planifiée qui en découle.

Détails A6, suite et clôture (`apps/web/app/globals.css`, `apps/web/e2e/accessibility.spec.ts`) :

- **contrastes** : calcul programmatique (luminance relative WCAG, formule officielle) de chaque
  paire texte/fond des jetons de conception, clair et sombre. La quasi-totalité passait déjà AA
  (4.5:1) - le travail d'A1/A2 était soigné - mais deux échecs réels sont ressortis : `.hero-summary
  small` en clair (4.23:1, opacité de blanc relevée de 0.58 à 0.68) et surtout `--warning` en mode
  sombre (3.11:1 seulement) - ce jeton n'était tout simplement jamais redéfini pour le sombre et
  restait donc sur sa valeur claire (un brun-doré sourd) au lieu de reprendre `--accent-300` comme
  `--gold` le fait déjà ; corrigé en ajoutant cette redéfinition dans les deux blocs de thème sombre
  (`prefers-color-scheme` et `data-theme="dark"`). `--accent-700` (le `--warning` du mode clair) est
  aussi légèrement assombri (`#8a6a12` → `#7c5e11`) pour sortir de la limite (4.46:1 → 5.34:1) plutôt
  que de rester au ras du seuil. Aucune couleur de texte codée en dur en dehors de `globals.css` :
  tous les fichiers `*.module.css` consomment les jetons partagés, donc ces trois correctifs
  s'appliquent uniformément aux sept portails ;
- **navigation clavier** : aucun `tabIndex` positif, aucun gestionnaire `onClick` sur un élément non
  interactif (`<div>`), aucune modale dans tout le dépôt web - l'ordre de tabulation suit donc déjà
  l'ordre du DOM et aucun piège clavier n'existe. Ce qui manquait réellement (WCAG 2.4.1 « Bypass
  Blocks ») : un lien d'évitement pour sauter l'en-tête et la navigation répétés sur chaque page et
  atterrir directement dans le contenu. Ajouté (`.skip-link` dans `globals.css`, hors écran jusqu'au
  focus) comme tout premier élément des huit points d'entrée du produit (les six `layout.tsx` de
  portail, `/notifications`, `/mes-donnees`, et le tableau de bord Direction à structure propre) ;
- **lecteurs d'écran** : aucun lecteur d'écran réel (NVDA, JAWS, VoiceOver) n'est disponible dans cet
  environnement d'exécution pour une vérification humaine - même limite que pour Docker (docs
  précédentes de ce document). À la place, `apps/web/e2e/accessibility.spec.ts` intègre
  `@axe-core/playwright` et fait tourner un scan WCAG 2.1 A/AA complet (étiquettes, rôles ARIA,
  landmarks, structure de titres, contrastes recalculés dans le navigateur réel) sur la page
  d'accueil, les pages de connexion PME et administration, le portail PME après connexion en clair
  et en sombre, et `/mes-donnees` (axe B6) - une régression future sur n'importe laquelle de ces
  pages est donc détectée automatiquement, pas seulement au moment de cet audit ponctuel ;
- vérifié : `pnpm lint`, `npx tsc --noEmit`, `pnpm --filter @fodip/web build`, `npx playwright test
  --list` (les 5 nouveaux tests sont découverts). Comme pour les précédents specs Playwright, leur
  exécution réelle nécessite la pile Docker complète, indisponible ici (`dockerd` ne démarre pas
  dans ce bac à sable) - confirmée par la CI.

Détails A5 (`apps/web/app/design-system/`) :

- l'équivalent léger explicitement permis par la formulation de l'axe (« Storybook ou équivalent
  léger ») plutôt que Storybook lui-même : une page `/design-system` dans l'application Next.js
  existante, sans nouvelle brique d'outillage, de configuration de build séparée ni de risque de
  compatibilité avec des versions aussi récentes que Next 16/React 19/Turbopack ;
- vivante plutôt que recopiée : chaque exemple de la page (boutons, badges, cartes, tableau,
  messages, champs de formulaire) est rendu avec les mêmes classes que le produit
  (`globals.css`, `entrepreneur/portal.module.css`, déjà réutilisées par les sept portails) - une
  évolution d'un jeton ou d'une classe partagée se reflète ici sans double maintenance ;
- couvre les quatre sections demandées : palette et échelles de couleur (avec un rappel visuel des
  contrastes vérifiés AA à l'axe A6, y compris le badge d'avertissement dont le mode sombre vient
  d'être corrigé), typographie, composants (boutons, formulaires, cartes, tableaux, badges de
  statut, messages), et un rappel des mécanismes d'accessibilité du produit (lien d'évitement,
  anneau de focus, scan automatisé) ;
- accessible publiquement (comme la page d'accueil - aucune donnée métier n'y transite), liée
  depuis le pied de page de l'accueil, et elle-même couverte par le scan `@axe-core/playwright`
  ajouté à l'axe A6 - une régression d'accessibilité sur la page de référence du design system
  serait particulièrement ironique à laisser passer.

Détails B5, partiel (`apps/api/src/security-policy.js`, `database/013_pii_encryption.sql`) :

- B5 recouvre en réalité deux choses : le **mécanisme** de chiffrement au repos, et la **garde de
  la clé** en production (sauvegarde, rotation, éventuellement un vrai KMS/HSM). La seconde n'a de
  sens qu'une fois l'hébergement choisi (axe B7b) - matériel dédié, coffre-fort applicatif d'un
  fournisseur cloud, etc. sont des options radicalement différentes selon la cible. Cette itération
  construit uniquement le mécanisme, en réutilisant ce qui existait déjà plutôt qu'en inventant une
  nouvelle brique : `AdministrationRepository`/`DataRightsRepository` dérivent leur clé de
  chiffrement du même `JWT_SECRET` déjà validé, via un contexte HMAC dédié
  (`deriveSecret(jwtSecret, 'fodip-pii-telephone-encryption-v1')`) - exactement le pattern déjà en
  production pour le secret TOTP MFA (`MfaService`, axe B2) plutôt qu'un nouveau secret à
  provisionner et sauvegarder séparément ;
- premier champ couvert : `utilisateurs.telephone`, chiffré en AES-256-GCM
  (`security-policy.js#encryptWithKey`, déjà testé unitairement pour le secret MFA). Choisi parce
  que c'est le seul champ de donnée personnelle d'une personne physique avec un chemin d'écriture
  réellement exercé par l'application (`AdministrationRepository#create` - il n'existe même pas de
  chemin de mise à jour du téléphone) et jamais utilisé dans une recherche/égalité SQL (vérifié :
  seul `utilisateurs.email`/`nom`/`prenom` sont recherchés par `ILIKE`, jamais `telephone`) - le
  chiffrer ne casse donc aucune fonctionnalité existante ;
- délibérément laissés de côté cette itération : `entreprises.telephone`/`email`/`adresse` (donnée
  de contact d'une personne morale, pas d'une personne physique) ; `entreprise_dirigeants.telephone`/
  `email` (donnée personnelle réelle, mais actuellement en lecture seule côté API - aucune route
  ne les crée ni ne les modifie, donc rien à chiffrer sur écriture aujourd'hui ; à reprendre le jour
  où un flux de création/modification des dirigeants existera) ; `utilisateurs.email`/`nom`/`prenom`
  (recherchés par `ILIKE` dans `administration.repository.ts#listUsers`, et `email` sert de clé de
  connexion - les chiffrer casserait la recherche admin et l'authentification, qui reposent toutes
  deux sur une égalité/correspondance SQL en clair) ;
- migration additive (`ALTER TABLE utilisateurs ALTER COLUMN telephone TYPE VARCHAR(255)` - un
  élargissement, jamais destructif) : un ciphertext AES-256-GCM (IV 12 octets + tag
  d'authentification 16 octets + texte chiffré, encodé en base64) est toujours plus long que le
  numéro de téléphone en clair qu'il remplace, et aurait dépassé l'ancien `VARCHAR(50)` ;
- vérifié : deux nouvelles suites de tests unitaires directement sur les repositories
  (`apps/api/test/administration.repository.spec.ts`, `data-rights.repository.spec.ts`) - une
  première dans ce dépôt, où chaque repository n'était jusqu'ici exercé que via la suite e2e
  Docker, justifiée ici parce que ces deux-là contiennent désormais une vraie logique applicative
  (chiffrer avant l'INSERT, déchiffrer après le SELECT) qui vaut la peine d'être isolée de la base
  de données. Complété par `apps/web/e2e/pii-encryption.spec.ts`, qui crée un compte avec un
  numéro de téléphone via l'API réelle et vérifie qu'il ressort identique - le seul test qui
  exerce l'aller-retour contre un vrai PostgreSQL (une erreur de calcul de longueur de colonne
  tronquerait silencieusement le ciphertext dans un mock, pas ici). `pnpm lint`, `npx tsc --noEmit`,
  build api+web, `python3 scripts/check-migrations.py` (16 migrations validées), 106 tests API,
  `npx playwright test --list` (12 tests découverts) tous verts ; exécution réelle des specs
  Playwright laissée à la CI comme pour les précédentes (aucun démon Docker dans ce bac à sable).

Détails C6, partiel (`scripts/backup-postgres.sh`, `scripts/restore-postgres.sh`,
`scripts/test-backup-restore.sh`, `docs/16-SAUVEGARDES-RESTAURATION.md`) :

- même découpage que B5/B6 : le **mécanisme** de sauvegarde/restauration ne dépend d'aucune
  décision d'hébergement et se construit maintenant ; sa **planification** en production (fréquence,
  réplication hors site, rétention, RPO/RTO formels) n'a de sens qu'une fois la cible choisie (axe
  B7b) - un PostgreSQL managé (Neon, Supabase, RDS...) a en général ses propres sauvegardes
  intégrées à réutiliser plutôt qu'à dupliquer, un PostgreSQL auto-hébergé a besoin exactement de ce
  mécanisme, planifié par l'ordonnanceur de tâches de la plateforme cible ;
- les trois scripts passent par le conteneur `postgres:16.10-alpine` de `docker-compose.yml`
  (`docker compose exec`) plutôt que par un `pg_dump`/`pg_restore` installé sur l'hôte - mêmes
  outils client que le serveur, garantis compatibles, exactement le principe déjà appliqué par les
  conteneurs `migrations`/`seed` du même fichier ;
- `restore-postgres.sh` refuse de s'exécuter sans `--force` quand la cible est la base réelle
  (par défaut) - une restauration écrase des données, une erreur de frappe ne doit pas y conduire
  silencieusement. `--target-db` restaure dans une base différente (typiquement jetable) pour
  vérifier une sauvegarde sans toucher à la base réelle ;
- le point important de l'axe C6 n'est pas « sauvegarder » mais « sauvegarder **et vérifier que ça
  se restaure** » : `test-backup-restore.sh` sauvegarde la base réelle, restaure la sauvegarde dans
  une base jetable, puis compare le nombre de lignes de chaque table entre l'originale et la copie
  restaurée - table par table, sans lister les tables à la main (elles sont énumérées dynamiquement
  via `information_schema.tables`), pour ne pas se dérégler au fil des futures migrations. Ce script
  tourne désormais à chaque exécution de la CI (`.github/workflows/ci.yml`, juste après le test de
  fumée Docker existant), contre une vraie instance PostgreSQL réellement seedée - une régression du
  mécanisme casserait la CI plutôt que de rester silencieuse jusqu'à une tentative de reprise après
  sinistre réelle ;
- vérifié : `bash -n` sur les trois scripts (ajouté à `scripts/test-prepush.sh`, comme pour
  `docker-smoke.sh`), `docker compose config --quiet`, et une relecture attentive de chaque commande
  (`pg_dump`/`pg_restore` via `docker compose exec -T`, redirections stdin/stdout, `psql -c` répétés
  pour créer/supprimer la base de test) contre les comportements documentés de ces outils. Comme
  pour les précédents scripts dépendant de Docker, leur exécution réelle contre une vraie base
  n'a pas pu être vérifiée dans ce bac à sable (aucun démon Docker disponible) - la CI, qui exécute
  désormais `test-backup-restore.sh` à chaque run, en apportera la première confirmation réelle.

Détails C3b/C4 (`apps/api/src/metrics/`, `monitoring/`, `docs/17-METRIQUES-OBSERVABILITE.md`) :

- C4 posait « nécessite un backend d'observabilité cible (Grafana/Datadog/...) » comme un choix
  ouvert. Tranché dans le même esprit que B4 (Keycloak) plutôt que laissé en attente : Prometheus
  + Grafana auto-hébergés, ajoutés à `docker-compose.yml` derrière un profil `observability` -
  absents d'un `docker compose up` normal (donc de la CI, qui n'active jamais de profil : zéro
  image supplémentaire à tirer, zéro conteneur supplémentaire à attendre pour les PR qui n'ont rien
  à voir avec l'observabilité), démarrés uniquement sur demande
  (`docker compose --profile observability up`) ;
- `GET /api/v1/metrics` (axe C3b, `prom-client`) expose un histogramme unique,
  `fodip_api_http_request_duration_seconds`, étiqueté méthode/route/code de statut - la route est
  le motif associé par Nest (`request.route.path`, ex. `/api/v1/administration/users/:id`), jamais
  l'URL brute, pour ne pas créer une série par UUID (ou, pour une requête qui n'a jamais matché de
  route du tout, une série par URL invalide envoyée par un client cassé ou un scan) ; enregistré
  par un middleware plutôt qu'un intercepteur - lire `response.statusCode` dans le callback
  `'finish'` de la réponse plutôt que dans la branche d'erreur d'un intercepteur RxJS, qui
  s'exécute avant que le filtre d'exceptions global ait fixé le code de statut réel ;
- vérifié directement plutôt que déduit du code, PostgreSQL et Prometheus étant tous deux
  installables sans Docker dans cet environnement : l'API réelle (compilée, lancée en local contre
  un vrai PostgreSQL migré et seedé) a servi un format d'exposition validé par `promtool check
  metrics` (le lint officiel de Prometheus) pour la métrique propre à ce dépôt ; un vrai binaire
  `prometheus` a scruté cette API avec succès (`"health": "up"`) ; les trois requêtes PromQL du
  tableau de bord (débit par route, latence p95, taux d'erreur) ont été exécutées contre ce
  Prometheus réel et retournent les valeurs attendues. Seul le rendu du tableau de bord dans
  Grafana lui-même n'a pas pu être vérifié directement (paquet hors politique réseau de cet
  environnement) - le JSON suit le schéma Grafana standard et référence ces mêmes requêtes déjà
  confirmées ;
- 112 tests API (`metrics.service.spec.ts`, `metrics.middleware.spec.ts`, plus une assertion dans
  `app.e2e-spec.ts` confirmant `/metrics` public et servant un vrai scrape - la même famille de
  test que celle qui protège déjà `/health`) ; `pnpm lint`, `npx tsc --noEmit`,
  `docker compose config --quiet`, `python3 scripts/check-docker.py` tous verts.

Détails D2 (`apps/web/public/manifest.webmanifest`, `apps/web/public/sw.js`,
`apps/web/app/hors-ligne/`, `docs/18-PWA-HORS-LIGNE.md`) :

- axe purement frontend, sans dépendance à une décision d'hébergeur - aucune raison de le laisser
  « à faire » plutôt que de l'implémenter directement ;
- service worker écrit à la main (pas de Workbox), trois règles seulement : `/api/*` et toute
  méthode non-GET traversent toujours le réseau (jamais de données de session ou personnelles
  rejouées depuis un cache partagé) ; une navigation de page est réseau d'abord, avec repli vers
  `/hors-ligne` (mis en cache à l'installation) seulement si `fetch()` échoue ; les fichiers
  statiques hachés par contenu de Next sont cache d'abord ;
- icônes générées par `scripts/generate-pwa-icons.py` (aucune dépendance image dans ce dépôt -
  PNG assemblés à la main via `struct`/`zlib`), y compris une variante `maskable` recentrée dans
  la zone de sécurité ~80 % du manifeste W3C ; un premier essai de padding par trait a cassé les
  lettres du monogramme (autopsié et corrigé avant tout commit - voir l'historique du script) ;
  version finale relue visuellement (image PNG rendue) avant d'être retenue ;
- vérifié directement contre une vraie session Chromium (Playwright, même pipeline local sans
  Docker que C3b/C4) : enregistrement et prise de contrôle du service worker, contenu exact du
  cache du socle applicatif, contenu réel de la page `/hors-ligne` mise en cache, et absence de
  régression sur les 17 tests e2e existants une fois le service worker actif sur chaque portail ;
- limite trouvée en vérifiant plutôt que supposée : simuler une coupure réseau côté navigateur
  (`context.setOffline`, `context.route().abort()`) ne bloque pas les requêtes que le service
  worker émet lui-même - seule la page en émet dont Playwright peut intercepter dans cet
  environnement. `apps/web/e2e/pwa.spec.ts` vérifie donc ce qui est réellement démontrable ici
  plutôt qu'un scénario de bout en bout qui aurait pu passer même avec un service worker cassé ;
- un vrai bug que seule la CI a pu attraper, la vérification locale sans Docker ne pouvant
  structurellement pas le reproduire : `apps/web/Dockerfile` ne copiait pas `apps/web/public/`
  dans l'étage `runtime`, donc manifeste/icônes/service worker répondaient 404 dans le conteneur
  réel bien que fonctionnant parfaitement en local (où l'arborescence source complète est déjà sur
  disque). Corrigé, reproduit directement en simulant l'écart (retrait temporaire de `public/`),
  et un garde-fou ajouté à `scripts/check-docker.py` pour qu'un oubli similaire échoue la
  vérification pré-push au lieu de rester silencieux jusqu'au déploiement ; détail complet dans
  `docs/18-PWA-HORS-LIGNE.md`.
