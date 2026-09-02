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
- stockage documentaire privé MinIO via l’API S3 compatible
- contrôle de signature PDF/JPEG/PNG, limite 10 Mo et checksum SHA-256
- isolation documentaire par entreprise et audit des accès
- notifications persistantes générées par les événements métier PostgreSQL
- administration des utilisateurs, rôles et périmètres PME réservée au super-administrateur
- protection de son propre compte et du dernier super-administrateur actif

## Commandes

```bash
pnpm --filter @fodip/api dev
pnpm --filter @fodip/api test:prepush
pnpm --filter @fodip/api test
pnpm --filter @fodip/api build
```

## Sécurité

Aucun secret réel ne doit être commité. En production, `JWT_SECRET` doit contenir au moins 32 caractères et être fourni via un gestionnaire de secrets.
