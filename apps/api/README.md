# API — FODIP Digital 2030

Backend transactionnel institutionnel NestJS + TypeScript.

## Socle livré

- préfixe API `/api/v1`
- endpoint public `GET /api/v1/health`
- Swagger `/api/docs`
- PostgreSQL via `pg` avec pool de connexions
- authentification `POST /api/v1/auth/login`
- JWT Bearer par défaut sur les routes non publiques
- RBAC par rôles et permissions
- MFA TOTP obligatoire pour les rôles sensibles, avec enrôlement et prévention du rejeu
- SSO institutionnel OpenID Connect avec PKCE et jeton de livraison à usage unique
- révocation immédiate des sessions et rotation progressive des clés de signature JWT
- rate limiting distribué via PostgreSQL
- validation stricte des DTO
- tests pré-push sans dépendances externes pour les politiques de sécurité
- tests unitaires, d'intégration PostgreSQL/MinIO et e2e web exécutés par la CI
- stockage documentaire privé MinIO via l’API S3 compatible
- contrôle de signature PDF/JPEG/PNG, limite 10 Mo et checksum SHA-256
- isolation documentaire par entreprise et audit des accès
- notifications persistantes générées par les événements métier PostgreSQL
- administration des utilisateurs, rôles et périmètres PME réservée au super-administrateur
- protection de son propre compte et du dernier super-administrateur actif
- idempotence et maker-checker sur les opérations financières sensibles
- rapprochement bancaire transactionnel et audité

## Commandes

```bash
pnpm --filter @fodip/api dev
pnpm --filter @fodip/api test:prepush
pnpm --filter @fodip/api test
pnpm --filter @fodip/api build
```

## Sécurité

Aucun secret réel ne doit être commité. En production, les secrets doivent être fournis par un gestionnaire de secrets institutionnel ; `JWT_SECRET` doit contenir au moins 32 caractères. La mise en production est soumise au cadre `docs/26-CADRE-INSTITUTIONNEL.md`.
