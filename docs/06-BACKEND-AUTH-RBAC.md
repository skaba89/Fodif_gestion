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
- `POST /auth/mfa/confirm` et `POST /auth/mfa/verify` sont limités à 8 tentatives / 5 minutes / IP.

## Protections API transverses

- `helmet` sur toute réponse HTTP (HSTS, `X-Frame-Options`, `X-Content-Type-Options`, etc.) ; la CSP par défaut reste désactivée car `/api/docs` sert l'interface Swagger, qui a besoin de scripts/styles inline.
- limitation de débit (`@nestjs/throttler`) : 300 requêtes/minute/IP par défaut sur toute l'API, ramenée à 5 tentatives/minute/IP sur `POST /auth/login` pour limiter le brute force sur les mots de passe.
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
