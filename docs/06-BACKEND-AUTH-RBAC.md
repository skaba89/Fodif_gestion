# Étape 6 — Backend, authentification et RBAC

## Objectif

Transformer le prototype frontend en plateforme transactionnelle sécurisée sans coupler directement l'interface à PostgreSQL.

## Composants

- NestJS en monolithe modulaire
- PostgreSQL comme système de référence
- JWT pour les sessions API
- politique `deny by default` : toutes les routes sont authentifiées sauf celles annotées `@Public()`
- rôles et permissions lus depuis les tables `roles`, `permissions`, `utilisateur_roles`, `role_permissions`
- Swagger pour le contrat d'API

## Séquence de connexion

1. validation du DTO ;
2. recherche de l'utilisateur par email ;
3. vérification du statut actif ;
4. comparaison bcrypt du mot de passe ;
5. si `mfa_required = true`, la connexion se poursuit par le second facteur (voir ci-dessous) plutôt que d'émettre un token ;
6. émission JWT uniquement pour les comptes autorisés ;
7. mise à jour de `last_login_at`.

## Double authentification (TOTP)

Un compte marqué `mfa_required = true` ne reçoit jamais de token directement depuis `POST /auth/login` : la réponse contient à la place un défi de courte durée (5 minutes) qui doit être complété auprès de l'un des deux endpoints publics dédiés.

1. **Première connexion (enrôlement)** — si aucun secret TOTP n'est encore confirmé pour le compte, `POST /auth/login` renvoie `{ mfaSetupRequired: true, mfaChallenge, secret, otpauthUrl }`. Le secret (format base32) est à ajouter manuellement dans une application d'authentification (Google Authenticator, Authy, ...). Le client complète l'enrôlement avec `POST /auth/mfa/confirm { mfaChallenge, code }` : le premier code valide confirme le secret et émet le token final. Une tentative interrompue peut reprendre le même secret au prochain login (il n'est pas régénéré tant qu'il n'est pas confirmé).
2. **Connexions suivantes** — une fois le secret confirmé, `POST /auth/login` renvoie `{ mfaRequired: true, mfaChallenge }`. Le client soumet le code de son application via `POST /auth/mfa/verify { mfaChallenge, code }` pour obtenir le token final.

Détails d'implémentation (`auth/mfa/mfa.service.ts`) :

- le secret TOTP est chiffré au repos (AES-256-GCM) avec une clé dérivée de `JWT_SECRET` par HMAC-SHA256 (`security-policy.js#deriveSecret`) — aucune variable d'environnement supplémentaire à provisionner ;
- les jetons de défi (`mfaChallenge`) sont des JWT à portée strictement limitée : signés avec une clé dérivée différente de celle des tokens d'accès, avec un claim `purpose` (`mfa_setup` ou `mfa_login`) vérifié à la résolution — un défi ne peut donc jamais être rejoué comme un token d'authentification classique ;
- chaque code TOTP n'est acceptable qu'une seule fois : le compteur temporel accepté est stocké (`mfa_last_used_step`) et toute réutilisation, même dans la fenêtre de validité, est rejetée ;
- `POST /auth/mfa/confirm` et `POST /auth/mfa/verify` sont limités à 8 tentatives / 5 minutes, par jeton de défi (voir ci-dessous).

## SSO institutionnel (OpenID Connect)

Optionnel, désactivé par défaut. Permet aux agents publics (portails `agent`, `comite`,
`direction`, `administration`, `auditeur` — pas le portail PME/entrepreneur) de se connecter via
un fournisseur d'identité institutionnel (Keycloak ou tout autre IdP compatible OpenID Connect)
plutôt que par mot de passe. Voir `docs/14-ROADMAP-SAAS-PREMIUM.md` (axe B4) pour le contexte de
décision.

- activé uniquement si les quatre variables `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`,
  `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` sont renseignées (`OidcService#isEnabled`) ; sinon
  `GET /auth/oidc/login` et `GET /auth/oidc/callback` répondent 404 et aucun lien SSO n'apparaît
  sur les pages de connexion ;
- flux « Authorization Code + PKCE » standard (`openid-client`) : `GET /auth/oidc/login?portal=...`
  redirige vers le fournisseur d'identité avec un `code_challenge` PKCE, un `state` et un `nonce` ;
  `GET /auth/oidc/callback` vérifie ces trois éléments au retour. L'API restant sans état côté
  serveur, ils transitent dans un cookie `httpOnly`/`sameSite=lax` signé et à courte durée de vie
  (`fodip_oidc_flow`, 10 minutes, scope `/api/v1/auth/oidc`) plutôt que dans une session serveur ;
- **authentification, jamais provisioning** : le claim `email` renvoyé par l'IdP doit correspondre
  à un compte déjà actif en base (`users.actif`) — aucun compte ni rôle n'est créé automatiquement
  à la connexion. Un compte inconnu ou inactif est renvoyé vers la page de connexion avec
  `?oidc_error=account_not_found` ;
- le MFA TOTP existant n'est **jamais contourné** : si le compte résolu a `mfa_required = true`,
  l'étape suivante déclenche exactement le même défi que la connexion par mot de passe
  (`MfaService#beginChallenge`) avant l'émission du token final ;
- la redirection navigateur du callback vers la page de connexion du portail ne transporte jamais
  le token de session final : uniquement un jeton de livraison opaque à usage unique et très
  courte durée (`?oidc_token=...`, 2 minutes), signé avec une clé dérivée dédiée
  (`security-policy.js#deriveSecret`, distincte de celle des jetons de défi MFA et des tokens
  d'accès), échangé côté serveur par `POST /auth/oidc/exchange` — analogue à un
  `authorization_code` OAuth, jamais à une session utilisable directement.

## Portail Auditeur (supervision en lecture seule)

Le rôle `AUDITEUR` existe dans `roles`/`role_permissions` depuis `database/002_auth_rbac.sql`
(permissions `audit.read`, `financing.read`, `impact.read`) mais n'avait jamais de portail ni de
route API qui les vérifie réellement — les décorateurs `@RequireRoles` des contrôleurs
concernés ne l'incluaient pas, ce qui bloquait tout compte `AUDITEUR` avant même la vérification
de permission (`AuthorizationGuard` applique les deux contrôles en ET, voir
`common/guards/authorization.guard.ts`).

- `GET /audit/logs` (nouveau, `audit/`) : lecture paginée de `audit_logs` — table alimentée
  depuis `001_initial_schema.sql` par chaque module (administration, instruction agent, décision
  comité, scoring, documents, opérations de financement) mais jamais exposée en lecture
  auparavant. Filtrable par `entityType`/`action`, gardé par `@RequireRoles('AUDITEUR',
  'SUPER_ADMIN')` + `@RequirePermissions('audit.read')`.
- `GET /financings` et `GET /financings/:id` : `AUDITEUR` ajouté à la liste de rôles autorisés au
  niveau du contrôleur ; les routes de mutation (`financing.manage`, `disbursement.manage`,
  `repayment.manage`, `impact.manage`) restent fermées puisque `AUDITEUR` ne détient aucune de
  ces permissions dans `database/007_financing_operations.sql` — même principe que `ANALYSTE`,
  déjà dans cette liste et déjà limité en lecture seule de la même façon.
- portail web dédié (`apps/web/app/auditeur/`) : connexion (avec SSO le cas échéant, voir
  ci-dessus) puis tableau de bord en lecture seule montrant le portefeuille de financements et le
  journal d'audit, tous deux paginés (`_shared/Pagination.tsx`, axe C5) — aucune action de
  création, modification ou décaissement n'y est proposée.
- compte de démonstration local : `auditeur@fodip.local` (`database/seeds/002_analytics_demo.sql`,
  voir le README pour le mot de passe commun de démonstration).

## Portail Partenaire bancaire (axe D1)

Le rôle `PARTENAIRE_BANCAIRE` existait en base depuis le premier commit RBAC mais, contrairement à
`AUDITEUR`, son absence de fonctionnement n'était pas un simple oubli de garde d'accès : aucun
modèle de données ne reliait un partenaire bancaire à un sous-ensemble de dossiers/financements.
Voir `docs/14-ROADMAP-SAAS-PREMIUM.md` (axe D1) pour la décision de modèle.

- authentification identique à tous les autres comptes (email/mot de passe + JWT) : pas de
  sous-système de clé API séparé. `PARTENAIRE_BANCAIRE` n'est pas dans `admin-policy.js#PRIVILEGED_ROLES`
  et n'exige donc pas le MFA — cohérent avec un accès conçu pour être appelé programmatiquement
  par le système d'information de la banque plutôt que par un humain à chaque session ;
- périmètre (`database/011_partner_banks.sql`) : union de deux mécanismes indépendants — les
  financements où le partenaire est désigné banque correspondante
  (`financements.banque_partenaire_id`) et les financements des PME de son portefeuille client
  (`partenaire_entreprises`). Chaque requête de `PartnerController` (`GET /partner/financings`,
  `GET /partner/financings/:id`, `POST .../disbursements`, `POST .../repayments`) est scopée en
  base par le `partenaireBancaireId` de l'appelant (jamais par un identifiant transmis par le
  client) ; un financement hors périmètre renvoie 404, jamais 403 — même principe
  d'anti-énumération que l'isolation PME (`applications`/`companies` controllers) ;
- un partenaire ne planifie rien : il déclare un paiement déjà exécuté en une seule étape
  (contrairement au flux Direction planifier-puis-exécuter), validé par la même politique
  `finance-policy.js#validateAvailableAmount` que le flux interne. La vue détail exposée à un
  partenaire omet volontairement `impact` (reporting interne) et `audit` (identités des agents
  FODIP) ;
- `admin-policy.js#validateUserScope` exige un `partenaireBancaireId` pour tout compte
  `PARTENAIRE_BANCAIRE`, même principe que `PME_ENTERPRISE_SCOPE_REQUIRED` pour un compte PME ;
  les fiches `partenaires_bancaires` elles-mêmes sont provisionnées par SQL (aucun flux de
  création en libre-service côté API), exactement comme les `entreprises` PME le sont déjà ;
- portail web dédié (`apps/web/app/partenaire/`), volontairement sans lien SSO : un partenaire
  bancaire est un tiers externe, pas un agent public, donc hors du périmètre de l'IdP
  institutionnel (axe B4). Compte de démonstration local : `partenaire@fodip.local`
  (`database/seeds/003_partner_bank_demo.sql`).

## Protections API transverses

- `helmet` sur toute réponse HTTP (HSTS, `X-Frame-Options`, `X-Content-Type-Options`, etc.) ; la CSP par défaut reste désactivée car `/api/docs` sert l'interface Swagger, qui a besoin de scripts/styles inline.
- limitation de débit (`@nestjs/throttler`) : 300 requêtes/minute/IP par défaut sur toute l'API. Sur `POST /auth/login`, ramenée à 5 tentatives/minute **par compte visé** (l'email soumis) plutôt que par IP : le frontend étant un BFF qui relaie chaque connexion depuis le serveur, l'API ne voit jamais l'IP réelle du navigateur mais celle du conteneur web, identique pour tous les utilisateurs — une limite par IP à cet endroit limiterait soit la plateforme entière ensemble, soit rien du tout selon la topologie de déploiement. Même logique sur `POST /auth/mfa/confirm`/`verify`, ramenée à 8 tentatives/5 minutes par jeton de défi plutôt que par IP (`common/throttle-tracker.ts`).
- filtre d'exceptions global (`AllExceptionsFilter`) : toute erreur non anticipée (driver PostgreSQL, SDK S3, bug) est journalisée côté serveur mais renvoyée au client comme une 500 générique — jamais de détail interne (SQL, stack, endpoint de stockage) dans la réponse. Les exceptions HTTP volontaires (`BadRequestException`, `ForbiddenException`, ...) conservent leur statut et leur message.

## Garde-fous anti-régression

Avant push :

```bash
./scripts/test-prepush.sh
```

Après push, la CI doit exécuter :

```bash
pnpm --filter @fodip/api test
pnpm --filter @fodip/api build
pnpm --filter @fodip/web build
```

Une PR n'est pas fusionnée si un de ces contrôles échoue.
