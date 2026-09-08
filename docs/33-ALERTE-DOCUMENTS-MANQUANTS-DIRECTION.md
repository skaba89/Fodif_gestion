# 33 — Alerte Direction : pièces obligatoires manquantes

## Objectif

Le cockpit Direction générale signale désormais les dossiers déjà engagés dans le processus de financement qui ne respectent pas encore la checklist documentaire obligatoire de leur programme FODIP.

Cette alerte repose sur le référentiel introduit par `database/026_program_eligibility_checklist.sql`. Elle ne déduit aucune pièce obligatoire à partir du nom du programme et ne contient aucune liste codée en dur dans le frontend.

## Source de vérité

Pour chaque dossier, une pièce est requise uniquement si une ligne de `programme_documents_requis` :

- appartient au programme du dossier ;
- est `actif = TRUE` ;
- est `obligatoire = TRUE`.

Une exigence est considérée satisfaite uniquement lorsqu'un `dossier_documents` du même `type_document` :

- appartient au dossier ;
- est la version courante (`superseded_by IS NULL`) ;
- n'est pas rejeté (`statut_verification <> 'REJETE'`).

La règle est volontairement identique à celle utilisée par `ApplicationsRepository` pour calculer `documentsRequis`, `documentsPresents`, `documentsManquants` et `completudeDocumentsPct` dans le portail PME.

## Périmètre de l'alerte

Sont inclus les dossiers ayant au moins une pièce obligatoire manquante et déjà engagés dans le workflow.

Sont exclus :

- `BROUILLON` : la PME est encore en préparation ;
- `REJETE` : le dossier a quitté le pipeline actif ;
- `ANNULE` : le dossier a quitté le pipeline actif.

Un programme sans checklist obligatoire configurée ne génère aucune alerte. Cette règle évite de transformer une absence de paramétrage métier en faux défaut documentaire.

## Filtres Direction

L'alerte respecte les filtres transverses actuels du cockpit pour :

- région ;
- programme ;
- secteur.

Comme les autres « Points d'attention », elle représente un état courant du portefeuille et n'est pas recalculée comme un historique sur `from/to` ou sur un statut ponctuel choisi dans le tableau de bord.

## Restitution

L'alerte est exposée avec :

- sévérité `attention` ;
- nombre de dossiers concernés ;
- montant demandé cumulé de ces dossiers ;
- nombre total de pièces obligatoires encore manquantes dans le texte explicatif ;
- action recommandée de régularisation avant la prochaine étape décisionnelle.

Titre affiché :

> Dossiers avec pièces obligatoires manquantes

## Non-régression métier

Ce lot rend l'écart visible à la Direction mais **ne bloque toujours pas automatiquement la soumission** d'un dossier incomplet.

Le blocage de soumission ne doit être activé qu'après validation officielle par le FODIP des checklists de chaque programme et après mise en place d'une UX de remédiation PME suffisamment claire.

## Preuves automatisées

- `apps/api/test/integration/missing-documents-alert.integration-spec.ts` : PostgreSQL réel ;
- `apps/api/test/analytics.controller.spec.ts` : agrégation et ordre de sévérité ;
- `apps/web/e2e/direction-missing-documents-alert.spec.ts` : présence réelle de l'alerte dans le cockpit Direction sur la stack Docker de démonstration ;
- matrice CI existante : build, lint, sécurité, intégration PostgreSQL/MinIO, Docker, Trivy, SBOM, sauvegarde/restauration et Playwright.
