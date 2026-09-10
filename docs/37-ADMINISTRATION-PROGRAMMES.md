# 36 — Administration institutionnelle des programmes FODIP

## Objectif

Ce lot transforme le module Programmes d’un simple catalogue PME en un référentiel institutionnel administrable, versionné et auditable.

Il ne crée **aucun programme officiel** ni aucune règle financière supposée. Les valeurs de démonstration restent strictement des seeds de test. Les programmes réels doivent être saisis et validés par les acteurs habilités du FODIP.

## Surfaces fonctionnelles

### PME

La PME dispose d’un catalogue des programmes actifs avant de créer une demande. Pour chaque programme, elle voit :

- code et nom ;
- description ;
- montant minimal et maximal ;
- enveloppe indicative lorsqu’elle est renseignée ;
- apport minimal ;
- ancienneté minimale ;
- RCCM et NIF requis ;
- SLA d’instruction ;
- checklist des pièces obligatoires ;
- numéro de version des règles actives.

Seuls les programmes `ACTIVE`, dans leur période d’ouverture, sont exposés aux nouvelles demandes.

### Agent et Comité

Les agents d’instruction et les membres du comité peuvent consulter le même référentiel actif que la PME. Ils ne disposent d’aucune action d’administration des programmes.

### Analyste et Auditeur

Ils disposent d’une lecture du référentiel actif pour rapprocher les dossiers, indicateurs, décisions et règles applicables. L’accès reste en lecture seule.

### Direction FODIP

La Direction dispose d’une administration dédiée permettant :

- création d’un programme en `BROUILLON` ;
- saisie du nom, code, description et enveloppe ;
- paramétrage des bornes de financement ;
- paramétrage de l’apport, de l’ancienneté, du RCCM, du NIF et du SLA ;
- paramétrage de la checklist documentaire ;
- création d’une nouvelle version à partir de la version courante ;
- soumission d’une version en revue ;
- validation par un second acteur ;
- activation de la version validée ;
- archivage automatique de l’ancienne version active ;
- clôture ou archivage du programme ;
- consultation de l’historique des versions et du nombre de dossiers rattachés.

## Maker-checker

Une version ne peut pas être activée directement après sa préparation.

Le cycle est :

```text
Création / modification du brouillon
              ↓
         Soumission en revue
              ↓
 Validation par un second acteur
              ↓
            Activation
              ↓
Archivage de l’ancienne version active
```

Le même utilisateur ne peut pas préparer/soumettre puis se valider lui-même. Le backend vérifie l’identité de l’acteur ; le contrôle n’est pas seulement visuel dans le frontend.

Toute modification d’un brouillon déjà soumis annule sa soumission/validation précédente et impose une nouvelle revue.

## Non-rétroactivité

Le mécanisme livré par la migration `027_program_rule_versioning.sql` reste la règle de référence :

- lors de la première soumission, un dossier capture la version active ;
- les dossiers déjà soumis restent rattachés à cette version ;
- une nouvelle version ne modifie pas rétroactivement leurs critères ;
- PostgreSQL interdit la modification substantielle d’une version ou de sa checklist lorsqu’elle est déjà référencée par un dossier.

Le nouveau cycle d’administration respecte ces garde-fous et ne les contourne pas.

## RBAC

Permissions :

| Permission | PME | Agent | Comité | Direction | Analyste | Auditeur | Super Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| `program.read` | Oui | Oui | Oui | Oui | Oui | Oui | Oui |
| `program.manage` | Non | Non | Non | Oui | Non | Non | Oui |
| `program.approve` | Non | Non | Non | Oui | Non | Non | Oui |

Le Partenaire bancaire n’obtient pas d’accès général au référentiel des programmes dans ce lot ; son périmètre reste limité aux financements explicitement exposés à sa banque.

## API

Lecture :

- `GET /programs`
- `GET /programs/:id`

Administration :

- `GET /programs/management`
- `POST /programs/management`
- `GET /programs/management/:id`
- `PATCH /programs/management/:id`
- `POST /programs/management/:id/versions`
- `PATCH /programs/management/:id/versions/:version`
- `POST /programs/management/:id/versions/:version/submit`
- `POST /programs/management/:id/versions/:version/approve`
- `POST /programs/management/:id/versions/:version/activate`

Toutes les mutations sont authentifiées et soumises aux permissions serveur.

## Audit

Les événements suivants sont inscrits dans `audit_logs` :

- `PROGRAM_CREATED` ;
- `PROGRAM_UPDATED` ;
- `PROGRAM_RULE_DRAFT_CREATED` ;
- `PROGRAM_RULE_UPDATED` ;
- `PROGRAM_RULE_SUBMITTED` ;
- `PROGRAM_RULE_APPROVED` ;
- `PROGRAM_RULE_ACTIVATED`.

L’audit contient l’acteur, l’entité, l’identifiant et les valeurs utiles avant/après selon l’action.

## Données métier volontairement non inventées

Ce lot n’insère pas de nouveaux programmes FODIP réels. Les montants, enveloppes, périodes, critères et pièces doivent provenir d’une validation métier officielle.

Le système continue également à ne pas bloquer automatiquement une soumission PME sur les critères d’éligibilité. Ce verrou devra être activé uniquement lorsque les politiques des programmes réels, les dérogations et le parcours de remédiation auront été formellement validés.

## Preuves de non-régression

Le test PostgreSQL réel `program-management.integration-spec.ts` vérifie :

- création non publiée ;
- impossibilité d’auto-validation ;
- validation par un second acteur ;
- activation et publication ;
- création et activation de V2 ;
- archivage de V1 ;
- conservation d’un dossier verrouillé sur V1 ;
- permissions de lecture/gestion.

Le test Playwright `program-management.spec.ts` vérifie :

- surface de gestion Direction ;
- catalogue Agent en lecture seule ;
- refus HTTP 403 d’une mutation programme par un Agent ;
- catalogue PME et passage vers une nouvelle demande.

La PR ne doit être fusionnée qu’après réussite de la CI, de CodeQL, PostgreSQL/MinIO, Trivy, SBOM/signature, smoke Docker, backup/restore et Playwright multi-navigateurs.
