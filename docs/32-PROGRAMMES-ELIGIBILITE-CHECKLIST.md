# 32 — Programmes FODIP, éligibilité et checklist documentaire

## Objectif métier

Faire du **programme FODIP** la source de vérité de ses principales conditions d’accès et de ses pièces justificatives, au lieu de coder ces règles écran par écran.

Ce premier lot répond à un écart identifié lors de l’audit métier/QA : la plateforme savait gérer les documents d’un dossier, leur sécurité, leur versioning et leur vérification, mais ne savait pas déterminer si un dossier était **documentairement complet pour le programme choisi**.

## Ce que le lot ajoute

### Métadonnées d’éligibilité simples

`programmes_fodip` porte désormais, de manière additive :

- `enveloppe_totale` ;
- `apport_min_pct` ;
- `anciennete_min_mois` ;
- `rccm_requis` ;
- `nif_requis` ;
- `sla_instruction_jours`.

Les bornes de montant `montant_min` / `montant_max` existaient déjà et restent la référence.

Ces champs sont volontairement simples et explicites. Aucun moteur de règles générique/DSL n’est introduit avant validation des besoins réels par le FODIP.

### Checklist documentaire par programme

La table `programme_documents_requis` relie un programme à une liste ordonnée de documents :

- code métier ;
- libellé utilisateur ;
- type documentaire ;
- obligatoire ou facultatif ;
- durée de validité éventuelle ;
- état actif/inactif.

Les types sont limités à la taxonomie déjà autorisée par l’upload sécurisé :

- `RCCM` ;
- `NIF` ;
- `BUSINESS_PLAN` ;
- `ETATS_FINANCIERS` ;
- `GARANTIE` ;
- `AUTRE`.

Il n’existe donc pas deux vocabulaires documentaires divergents entre le paramétrage programme et le stockage des pièces.

## Règle de complétude

Pour un dossier, une pièce obligatoire est considérée présente uniquement si :

1. son `type_document` correspond à l’exigence du programme ;
2. la version du document est courante (`superseded_by IS NULL`) ;
3. la pièce n’est pas rejetée (`statut_verification <> 'REJETE'`).

La réponse dossier expose :

- `documentsRequis` ;
- `documentsPresents` ;
- `documentsManquants` ;
- `completudeDocumentsPct`.

Quand un programme ne possède **aucune exigence obligatoire configurée**, la complétude vaut 100 % et la liste des manquants reste vide. Cela signifie « aucune exigence configurée », pas « nous avons deviné que le dossier est conforme à une politique inexistante ».

## UX PME

### Nouvelle demande

Le choix du programme affiche avant la création du dossier :

- description ;
- minimum/maximum de financement ;
- apport minimal éventuel ;
- ancienneté minimale éventuelle ;
- pièces et justificatifs à préparer.

### Suivi des demandes

Chaque dossier affiche désormais une colonne **Pièces** :

`présentes / requises · pourcentage`

Les pièces manquantes restent accessibles via l’action **Documents**.

## Décision volontaire : pas de blocage à la soumission dans ce lot

Le système **n’empêche pas encore** une PME de soumettre un brouillon incomplet.

Cette décision est volontaire : les checklists réelles de chaque programme doivent d’abord être validées par les métiers FODIP. Bloquer un dossier sur une règle non approuvée serait plus dangereux que rendre l’incomplétude visible.

Le lot suivant pourra rendre la soumission bloquante uniquement lorsque :

1. la checklist du programme est validée ;
2. le canal de correction est clair pour la PME ;
3. les cas exceptionnels/dérogations sont définis ;
4. les tests couvrent les pièces manquantes, rejetées, remplacées et expirées.

## Données de démonstration

Le seed de démonstration configure `CROISSANCE-PME` avec :

- RCCM ;
- NIF ;
- business plan.

Ces valeurs servent uniquement à la démonstration et aux tests. Elles ne constituent pas une politique officielle du FODIP.

## Preuves QA

`apps/api/test/integration/program-requirements.integration-spec.ts` exerce les requêtes contre un vrai PostgreSQL :

- lecture des règles d’un programme ;
- checklist obligatoire + facultative ;
- dossier à 0 % ;
- passage à 33 % après dépôt d’une pièce valide ;
- pièce rejetée qui reste manquante ;
- programme sans checklist, sans faux manque.

Le scénario Playwright principal `apps/web/e2e/workflow.spec.ts` vérifie également la chaîne complète :

PostgreSQL → API NestJS → BFF Next.js → écran PME → suivi dossier.

## Suite recommandée

1. faire valider les checklists réelles programme par programme ;
2. ajouter l’alerte Direction « dossiers avec pièces obligatoires manquantes » ;
3. introduire le blocage de soumission uniquement pour les programmes explicitement validés ;
4. ajouter les règles d’expiration/validité documentaire ;
5. construire ensuite l’administration des programmes/enveloppes sans SQL manuel.
