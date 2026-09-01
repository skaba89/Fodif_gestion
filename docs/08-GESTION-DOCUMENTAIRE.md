# Étape 8 — Gestion documentaire sécurisée

Cette étape relie les dossiers PME à un stockage Azure Blob privé sans exposer de clé ni d’URL publique au navigateur.

## Parcours livré

1. La PME sélectionne un dossier qui lui appartient.
2. Le BFF Next.js transmet le formulaire avec le JWT conservé en cookie HttpOnly.
3. NestJS contrôle le rôle, la permission, l’entreprise et le statut du dossier.
4. Le serveur vérifie la taille, le MIME déclaré et la signature binaire du fichier.
5. Le serveur calcule le SHA-256 et génère une clé de stockage sans nom fourni par l’utilisateur.
6. Azure Blob reçoit le fichier dans un conteneur privé.
7. PostgreSQL reçoit les métadonnées et une trace d’audit.
8. Tout téléchargement est autorisé par l’API et son intégrité est recalculée avant restitution.

## Formats et limites MVP

- PDF (`application/pdf`)
- JPEG (`image/jpeg`)
- PNG (`image/png`)
- 10 Mo maximum par document

Les types métier admis sont `RCCM`, `NIF`, `BUSINESS_PLAN`, `ETATS_FINANCIERS`, `GARANTIE` et `AUTRE`.

## Isolation et stockage

Une PME ne fournit jamais un `entreprise_id`. Celui-ci provient exclusivement du JWT enrichi par le backend. Chaque requête SQL de lecture vérifie la relation entre le document, le dossier et cette entreprise.

La clé Blob suit le format :

```text
companies/{entrepriseId}/applications/{dossierId}/{documentId}.{extension}
```

Le nom d’origine n’est jamais utilisé comme clé Blob. Les séquences de chemin et caractères de contrôle sont supprimés avant conservation du libellé en base.

En production, `DefaultAzureCredential` utilise l’identité managée du service. Une chaîne de connexion est acceptée uniquement pour Azurite en développement local.

## Vérification agent

Les agents autorisés disposent des contrats API suivants :

- `GET /api/v1/documents/review/pending`
- `GET /api/v1/documents/review/:documentId/download`
- `POST /api/v1/documents/:documentId/verification`

Les décisions possibles sont `VALIDE`, `REJETE` et `A_COMPLETER`. Un commentaire est obligatoire pour un rejet ou une demande de complément. Uploads, téléchargements et vérifications sont inscrits dans `audit_logs`.

## Contrôles anti-régression

- tests de signature binaire et de MIME forgé ;
- rejet des fichiers vides et trop volumineux ;
- contrôle d’appartenance et de statut du dossier ;
- test de génération de clé et de neutralisation du nom ;
- suppression compensatoire du Blob si PostgreSQL échoue ;
- détection d’une altération par checksum ;
- authentification obligatoire sur upload et téléchargement ;
- validation additive de la migration SQL ;
- tests API et builds API/web.

## Limite assumée

Cette livraison effectue une validation de format et d’intégrité, mais ne remplace pas un antivirus. Avant la production, Microsoft Defender for Storage ou un scanner asynchrone équivalent devra placer les fichiers en quarantaine jusqu’au résultat d’analyse.
