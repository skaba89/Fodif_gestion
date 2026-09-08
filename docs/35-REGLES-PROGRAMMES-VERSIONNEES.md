# Étape 35 — Règles de programmes versionnées et non rétroactives

## Objectif institutionnel

Un dossier FODIP doit toujours pouvoir être expliqué avec les règles qui étaient applicables au
moment où la PME l'a soumis. Une évolution ultérieure d'un programme ne doit jamais modifier
silencieusement l'interprétation d'un dossier déjà engagé dans le processus de décision.

Exemple : si l'apport minimal passe de 10 % à 15 % le 1er juin, un dossier soumis en mai doit rester
rattaché à la version qui exigeait 10 %. Le dossier ne doit pas être réévalué implicitement avec la
nouvelle règle.

Ce lot pose ce socle sans inventer de règle métier FODIP et sans rendre l'éligibilité bloquante.

## Modèle livré

### `programme_regles_versions`

Chaque programme peut disposer de plusieurs versions successives :

- numéro de version ;
- statut `BROUILLON`, `ACTIVE` ou `ARCHIVEE` ;
- période d'effet ;
- montant minimal et maximal ;
- apport minimal ;
- ancienneté minimale ;
- RCCM requis ;
- NIF requis ;
- SLA d'instruction.

Une contrainte PostgreSQL garantit qu'un programme ne possède qu'une seule version `ACTIVE` à la
fois.

### `programme_regle_documents`

La checklist documentaire appartient désormais à une version précise des règles. Elle contient les
mêmes catégories documentaires déjà autorisées par la plateforme et n'introduit aucun nouveau type
non validé.

### `dossiers_financement.programme_regle_version_id`

Le dossier mémorise la version qui lui est applicable.

- tant qu'il est en `BROUILLON`, le dossier n'est pas verrouillé et l'interface peut présenter la
  version active du programme ;
- lors de la première transition `BROUILLON -> SOUMIS`, l'API capture la version active ;
- après cette soumission, les calculs documentaires du dossier utilisent cette version historique,
  même lorsqu'une nouvelle version devient active pour les futurs dossiers.

## Migration des données existantes

La migration `027_program_rule_versioning.sql` est additive.

Pour chaque programme existant, elle crée une version initiale `1` à partir des critères et de la
checklist déjà configurés. Les dossiers qui avaient déjà quitté l'état `BROUILLON` sont rattachés à
cette version initiale. Les brouillons restent volontairement non verrouillés et prendront la
version active lors de leur première soumission.

Les anciennes colonnes et la table `programme_documents_requis` sont conservées. Elles servent de
fallback de compatibilité lorsqu'un programme créé par un ancien import, un test ou un processus de
transition ne possède pas encore de version active.

## Immutabilité et audit

Deux garde-fous PostgreSQL empêchent de réécrire l'histoire :

1. dès qu'une version est référencée par un dossier, ses critères substantiels ne peuvent plus être
   modifiés ;
2. dès qu'une version est référencée par un dossier, sa checklist ne peut plus être ajoutée,
   modifiée ou supprimée.

Le statut de la version et sa date de fin d'effet peuvent encore évoluer afin d'archiver proprement
une version avant d'en activer une nouvelle.

La règle opérationnelle devient donc :

```text
Version N active
      ↓
Première soumission du dossier
      ↓
Dossier verrouillé sur N
      ↓
Archivage de N
      ↓
Activation de N+1
      ↓
Les anciens dossiers restent sur N
Les nouveaux dossiers prennent N+1
```

## Cohérence PME / Direction

Deux surfaces utilisent exactement la même source de vérité :

- la complétude documentaire affichée à la PME ;
- l'alerte Direction « dossiers avec pièces obligatoires manquantes ».

Ainsi, le Directeur général ne peut pas voir un dossier comme incomplet selon une règle différente
de celle qui était réellement applicable à la PME au moment de sa soumission.

## Changement de programme

Un dossier peut changer de programme tant qu'il est en `BROUILLON`.

Après sa première soumission, un retour `COMPLEMENT_REQUIS` permet toujours de corriger les autres
informations autorisées, mais ne permet plus de changer de programme. Ce garde-fou évite qu'un
dossier reste lié à la version historique d'un programme tout en étant déplacé vers un autre.

## Ce que ce lot ne fait pas

Ce lot ne :

- bloque pas une soumission selon l'apport, l'ancienneté, le RCCM, le NIF ou la checklist ;
- ne crée aucune nouvelle valeur officielle de programme ;
- ne modifie aucun montant existant ;
- ne change aucune permission, aucun rôle, MFA ou règle financière ;
- ne fournit pas encore l'écran d'administration permettant de préparer, valider et activer une
  nouvelle version ;
- ne versionne pas `enveloppe_totale` : l'enveloppe relève du futur modèle de mobilisation et
  d'allocation des ressources, pas de l'éligibilité historique d'un dossier.

Le blocage d'éligibilité restera conditionné à une validation métier officielle et à une UX de
remédiation PME adaptée.

## Preuves QA

Les tests d'intégration PostgreSQL réel couvrent notamment :

- compatibilité d'un programme sans version ;
- lecture de la version active par `/programs` ;
- capture de V1 lors de la première soumission ;
- activation de V2 ;
- maintien du premier dossier sur V1 ;
- rattachement d'un nouveau dossier à V2 ;
- refus PostgreSQL d'une modification de V1 après référence ;
- refus PostgreSQL d'une modification de la checklist V1 après référence ;
- refus d'un changement de programme après entrée en `COMPLEMENT_REQUIS` ;
- maintien de l'alerte Direction sur la checklist historique du dossier.

## Prochaine évolution recommandée

Le prochain lot programme doit être une administration institutionnelle des versions :

```text
Brouillon de règles
        ↓
Revue / validation métier
        ↓
Activation datée
        ↓
Archivage automatique de l'ancienne version
        ↓
Journal d'audit
```

Cette administration devra respecter le maker-checker et les délégations qui seront validés par le
FODIP. Elle ne doit pas être construite comme un simple CRUD permettant de modifier directement une
version déjà utilisée.
