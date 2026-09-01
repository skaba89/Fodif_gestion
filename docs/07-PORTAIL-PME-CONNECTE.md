# Étape 7 — Portail PME connecté

Le portail PME est désormais relié au backend NestJS et à PostgreSQL.

## Sécurité

- JWT enrichi avec `entrepriseId` à partir de `utilisateur_entreprises`.
- Une PME sans entreprise associée ne peut pas se connecter au portail métier.
- Le navigateur ne reçoit pas le JWT : Next.js le conserve dans un cookie HttpOnly.
- Les routes Next.js `/api/pme/*` servent de BFF same-origin.
- Toutes les lectures et écritures de dossiers incluent `entreprise_id` côté SQL.
- Les brouillons ne sont modifiables que dans les statuts autorisés.
- La soumission `BROUILLON -> SOUMIS` et l’écriture de l’historique sont atomiques.

## API

- `GET/PATCH /api/v1/companies/me`
- `GET /api/v1/programs`
- `GET /api/v1/applications/me`
- `POST /api/v1/applications`
- `PATCH /api/v1/applications/:id`
- `POST /api/v1/applications/:id/submit`

## Anti-régression

Avant push : tests d’isolation PME et vérification syntaxique TypeScript/TSX.

En CI : tests pré-push, tests e2e API, tests d’isolation, build API et build web.

## Limites de cette étape

Le stockage documentaire sécurisé et le MFA complet sont volontairement hors périmètre de cette livraison et restent les prochaines briques prioritaires.
