# API — FODIP Digital 2030

Backend NestJS + TypeScript du MVP transactionnel.

## Socle livré

- préfixe API `/api/v1`
- endpoint public `GET /api/v1/health`
- Swagger `/api/docs`
- PostgreSQL via `pg` avec pool de connexions
- authentification `POST /api/v1/auth/login`
- JWT Bearer par défaut sur les routes non publiques
- RBAC par rôles et permissions
- refus explicite des comptes marqués `mfa_required` tant que le challenge MFA n'est pas livré
- validation stricte des DTO
- tests pré-push sans dépendances externes pour les politiques de sécurité
- tests e2e exécutés par la CI
- stockage documentaire Azure Blob privé via identité managée
- contrôle de signature PDF/JPEG/PNG, limite 10 Mo et checksum SHA-256
- isolation documentaire par entreprise et audit des accès

## Commandes

```bash
pnpm --filter @fodip/api dev
pnpm --filter @fodip/api test:prepush
pnpm --filter @fodip/api test
pnpm --filter @fodip/api build
```

## Sécurité

Aucun secret réel ne doit être commité. En production, `JWT_SECRET` doit contenir au moins 32 caractères et être fourni via un gestionnaire de secrets.
