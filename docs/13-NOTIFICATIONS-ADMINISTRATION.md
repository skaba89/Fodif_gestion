# Étape 13 — Notifications et administration

## Notifications persistantes

Les notifications sont stockées dans PostgreSQL et toujours rattachées à un utilisateur. Les routes de lecture utilisent l’identifiant du JWT : un utilisateur ne peut donc ni lire ni acquitter les notifications d’un autre compte.

Les événements sont produits par des triggers PostgreSQL dans la même transaction que l’opération métier. Cette approche couvre l’interface web actuelle et les futures API partenaires sans dupliquer la logique.

| Événement | Destinataire | Lien métier |
|---|---|---|
| Dossier soumis | Agents FODIP actifs | Fiche d’instruction |
| Dossier prêt pour comité | Membres du comité actifs | Fiche décisionnelle |
| Complément, transmission, décision | Utilisateurs de la PME | Suivi des dossiers |
| Décaissement effectué | Utilisateurs de la PME | Suivi des dossiers |
| Remboursement enregistré | Utilisateurs de la PME | Suivi des dossiers |

Une clé de déduplication empêche l’émission répétée du même événement pour un utilisateur. Le centre `/notifications` permet de filtrer les non-lues, d’acquitter une notification et de tout marquer comme lu.

## Administration RBAC

Le portail `/administration/utilisateurs` est limité au rôle `SUPER_ADMIN` et aux permissions `user.manage` et `role.read`.

Il permet de :

- créer un utilisateur avec un mot de passe initial fort et haché en bcrypt ;
- attribuer un ou plusieurs rôles existants ;
- rattacher obligatoirement un compte PME à son entreprise ;
- activer ou suspendre un compte ;
- marquer un compte comme soumis au MFA ;
- consulter les permissions effectives de chaque rôle.

Le MFA est **imposé, pas seulement proposé**, pour les rôles sensibles (`SUPER_ADMIN`, `DIRECTION_FODIP`, `AGENT_FODIP`, `ANALYSTE`, `COMITE_FINANCEMENT`, `AUDITEUR` — `admin-policy.js#PRIVILEGED_ROLES`) : à la création comme à la mise à jour d'un utilisateur, `mfa_required` est forcé à vrai dès qu'un de ces rôles est attribué, que l'administrateur l'ait demandé ou non, et un changement de rôle qui ne mentionne pas le champ ne peut pas le désactiver implicitement.

Les opérations `CREATE_USER` et `UPDATE_USER` sont écrites dans `audit_logs`. Le mot de passe et son hash ne sont jamais inclus dans l’audit.

## Protections

- email unique, normalisé en minuscules ;
- rôles vérifiés contre le référentiel en base ;
- entreprise vérifiée et non supprimée ;
- interdiction de désactiver son propre compte ;
- interdiction de désactiver ou rétrograder le dernier super-administrateur actif ;
- verrou transactionnel contre deux rétrogradations administratives concurrentes ;
- routes protégées par JWT, rôle et permissions.

## Validation Docker

Le smoke test vérifie la création automatique des notifications, leur isolation et leur acquittement. Il connecte aussi le super-administrateur, crée un auditeur, le suspend, relit son état et contrôle les traces d’audit directement dans PostgreSQL.
