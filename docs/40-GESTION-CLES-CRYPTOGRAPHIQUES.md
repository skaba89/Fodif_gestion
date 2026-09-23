# Gestion des clés cryptographiques FODIP

## Objet

Ce runbook définit la séparation, la rotation et la migration des secrets cryptographiques de
l'API. Il s'applique aux environnements institutionnels `PPD` et `PROD`.

Une clé ne doit servir qu'à un usage. Les secrets réels sont conservés dans un coffre-fort ou un
gestionnaire de secrets du cluster, jamais dans Git, un ticket, un journal ou une capture d'écran.

## Matrice des secrets

| Variable courante | Usage | Durée de l'ancien secret |
|---|---|---|
| `JWT_SECRET` | Signature des sessions API | `JWT_ACCESS_TTL` |
| `PII_ENCRYPTION_KEY` | Chiffrement du téléphone utilisateur | Jusqu'à migration de toutes les lignes |
| `MFA_SECRET_ENCRYPTION_KEY` | Chiffrement des graines TOTP | Jusqu'à migration de toutes les lignes |
| `MFA_CHALLENGE_SECRET` | Signature des défis MFA | 5 minutes |
| `OIDC_FLOW_SECRET` | Signature du cookie de flux OIDC | 10 minutes |
| `OIDC_DELIVERY_SECRET` | Signature du jeton OIDC à usage unique | 2 minutes |

Chaque valeur doit être aléatoire, différente des autres et contenir au moins 32 caractères.
Exemple de génération hors Git :

```bash
openssl rand -base64 48
```

## Format des données chiffrées

Les nouveaux téléphones et secrets TOTP utilisent une enveloppe AES-256-GCM :

```text
v1:<kid>:<iv + tag GCM + ciphertext en base64>
```

Le `kid` est un identifiant déterministe court de la clé dérivée. Il ne contient pas la clé.
Une enveloppe versionnée ne peut être déchiffrée que si sa clé courante ou précédente est
explicitement présente dans le trousseau. Un identifiant inconnu échoue immédiatement.

Les valeurs historiques sans préfixe restent lisibles pendant la migration avec
`LEGACY_DATA_ENCRYPTION_SECRET`.

## Première mise en service

1. Conserver la valeur actuelle de `JWT_SECRET`.
2. Générer indépendamment les cinq secrets dédiés.
3. Déployer sans modifier `JWT_SECRET`.
4. Vérifier la lecture d'un utilisateur avec téléphone historique et une authentification MFA
   déjà enrôlée.
5. Vérifier qu'une nouvelle création utilisateur produit un téléphone préfixé `v1:`.
6. Avant toute rotation ultérieure de `JWT_SECRET`, copier sa valeur historique dans
   `LEGACY_DATA_ENCRYPTION_SECRET`.
7. Conserver cette clé de migration tant que des chiffrés non versionnés existent.

Le code accepte aussi la valeur courante de `JWT_SECRET` comme candidat historique afin que
l'activation initiale des clés dédiées ne rende aucune donnée existante illisible.

## Rotation d'une clé de chiffrement

Exemple pour les PII :

1. Déplacer la valeur actuelle vers `PII_ENCRYPTION_KEY_PREVIOUS`.
2. Générer une nouvelle valeur `PII_ENCRYPTION_KEY`.
3. Déployer et vérifier lecture + écriture.
4. Ré-encrypter les lignes historiques dans une opération contrôlée, avec sauvegarde préalable,
   comptage avant/après et journal de changement.
5. Retirer `PII_ENCRYPTION_KEY_PREVIOUS` uniquement lorsque plus aucune enveloppe ne porte son
   `kid`.

La même procédure s'applique à `MFA_SECRET_ENCRYPTION_KEY`. La migration ne doit jamais écrire
la donnée en clair dans les logs ou dans une table temporaire.

## Rotation d'une clé de signature courte

Pour MFA/OIDC :

1. Déplacer la valeur actuelle vers la variable `*_PREVIOUS` correspondante.
2. Générer et déployer la nouvelle valeur courante.
3. Attendre au minimum la durée maximale indiquée dans la matrice.
4. Retirer la valeur précédente après vérification des métriques d'erreur.

Les nouveaux jetons sont toujours signés avec la clé courante. Les anciennes clés ne servent qu'à
vérifier des jetons déjà remis avant le déploiement.

## Garde-fous

- `APP_ENV=PPD` ou `APP_ENV=PROD` refuse de démarrer sans les secrets PII et MFA dédiés.
- Les secrets OIDC dédiés sont obligatoires dans ces environnements dès que le SSO est activé.
- Une valeur fournie mais faible ou égale à `CHANGE_ME` est refusée en environnement de
  production.
- `QUALIFICATION` conserve un repli vers `JWT_SECRET` pour permettre une montée de version
  progressive, mais le Blueprint Render provisionne déjà toutes les racines séparées.
- Une sauvegarde restaurable et un test de lecture sont obligatoires avant suppression d'une clé
  précédente ou de migration.
