# 38 — Référentiels, programmes par défaut et validation hiérarchique

## Objectif

Le module Programmes doit être utilisable dès l'installation sans imposer de saisie manuelle préalable, tout en empêchant la publication directe d'un programme proposé par un utilisateur opérationnel.

La cible distingue trois notions :

- **régions de référence** : unités géographiques stables utilisées pour le périmètre des programmes et des PME ;
- **secteurs d'activité de référence** : secteurs publics FODIP servant de base aux critères d'éligibilité et aux analyses ;
- **programmes de financement** : catalogue versionné, audité et soumis au maker-checker avant toute nouvelle publication utilisateur.

## Référentiels livrés par défaut

### Régions

La migration `029_reference_data_and_program_proposals.sql` charge les huit unités de niveau régional utilisées opérationnellement :

- Conakry ;
- Boké ;
- Kindia ;
- Mamou ;
- Labé ;
- Faranah ;
- Kankan ;
- N'Zérékoré.

Source institutionnelle de référence : Gouvernement de Guinée / Institut National de la Statistique.

### Secteurs FODIP

Les secteurs initiaux sont : Agriculture, Agro-industrie, Transformation, Commerce, Services, Industrie, Technologie, Artisanat, Tourisme et Logistique & Transport.

Ces valeurs proviennent des secteurs d'intervention/éligibilité publiés par le FODIP. Elles sont stockées dans `secteurs_activite` avec des codes stables. Une extension ultérieure par sous-secteurs peut utiliser `parent_id` sans casser les données existantes.

Source publique : https://fodip.gov.gn/

## Programmes par défaut

La migration amorce les lignes de financement publiquement visibles sur le site FODIP en septembre 2026 :

- `FIER-BOOST` — FIER BOOST ;
- `EXPORT-TRANSFORMATION` — GUICHET EXPORT ET TRANSFORMATION ;
- `ELLEVER` — ELLEVER.

Les noms et périodes publiques sont référencés, mais aucune règle non vérifiée n'est inventée : montant minimum/maximum par bénéficiaire, apport, ancienneté, documents et SLA restent à configurer par la gouvernance métier s'ils ne sont pas explicitement connus.

Chaque entrée par défaut porte `is_default = TRUE` et `source_reference = https://fodip.gov.gn/` afin de distinguer la donnée institutionnelle amorcée d'une proposition utilisateur.

## Périmètre région / secteur

Deux tables de liaison sont ajoutées :

- `programme_regions` ;
- `programme_secteurs`.

Une liste vide signifie volontairement **toutes les régions** ou **tous les secteurs**. Cela évite de recopier toutes les lignes de référence pour un programme national ou transversal.

## Workflow d'une proposition utilisateur

Le droit `program.propose` est attribué à `AGENT_FODIP`, `ANALYSTE`, `DIRECTION_FODIP` et `SUPER_ADMIN`.

Le droit ne donne jamais `program.manage` ni `program.approve` aux agents ou analystes.

Cycle :

```text
Utilisateur habilité
      ↓
BROUILLON personnel
      ↓
choix régions / secteurs / règles
      ↓
SOUMISSION
      ↓
Direction FODIP
      ↓
validation par un autre acteur
      ↓
ACTIVATION / PUBLICATION
```

Une proposition soumise est verrouillée côté proposant. Le contrôleur de gestion Direction reste l'unique surface d'approbation et d'activation. Le mécanisme existant interdit à un préparateur/soumissionnaire de valider lui-même sa version.

## API

Lecture des référentiels :

```text
GET /programs/references
```

Espace du proposant :

```text
GET   /programs/proposals
POST  /programs/proposals
GET   /programs/proposals/:id
PATCH /programs/proposals/:id
PATCH /programs/proposals/:id/versions/:version
POST  /programs/proposals/:id/versions/:version/submit
```

Validation hiérarchique existante :

```text
POST /programs/management/:id/versions/:version/approve
POST /programs/management/:id/versions/:version/activate
```

## Sécurité et audit

Toutes les routes de proposition utilisent `program.propose`. Les requêtes de lecture/modification sont filtrées serveur par `created_by = request.user.sub`; changer un identifiant dans l'URL ne permet donc pas d'accéder au brouillon d'un autre proposant.

Les événements `PROGRAM_PROPOSAL_CREATED`, `PROGRAM_PROPOSAL_UPDATED`, `PROGRAM_PROPOSAL_RULES_UPDATED` et `PROGRAM_PROPOSAL_SUBMITTED` sont enregistrés dans `audit_logs`.

## Tests

La qualification couvre :

- présence des régions et secteurs par défaut ;
- présence et provenance des programmes par défaut ;
- création d'une proposition avec périmètre région/secteur ;
- invisibilité de la proposition dans le catalogue actif avant validation ;
- isolation entre proposants ;
- verrouillage après soumission ;
- interdiction de l'auto-validation ;
- activation par un second acteur Direction ;
- absence de `program.approve` pour Agent/Analyste/PME/Partenaire ;
- présence du formulaire de proposition dans l'espace Agent via Playwright.
