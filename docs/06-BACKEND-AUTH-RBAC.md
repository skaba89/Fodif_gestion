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
5. si `mfa_required = true`, arrêt avec `MFA_REQUIRED` ;
6. émission JWT uniquement pour les comptes autorisés ;
7. mise à jour de `last_login_at`.

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
