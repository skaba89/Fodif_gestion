# Étape 1 — Périmètre fonctionnel du MVP

## Objectif

Le MVP de FODIP Digital 2030 doit couvrir le cycle principal de financement et de suivi d'une PME, sans chercher à implémenter dès la première version l'ensemble des fonctions nationales avancées.

## Modules du MVP

1. Référentiel PME
2. Demandes de financement
3. Gestion documentaire
4. Workflow d'instruction
5. Scoring d'aide à la décision
6. Comité de financement
7. Financement et décaissements
8. Suivi d'impact
9. Cockpit Direction
10. Sécurité, RBAC et audit

## Rôles initiaux

- SUPER_ADMIN
- DIRECTION_FODIP
- AGENT_FODIP
- ANALYSTE
- COMITE_FINANCEMENT
- PARTENAIRE_BANCAIRE
- PME
- AUDITEUR

## Workflow dossier

```text
BROUILLON
   ↓
SOUMIS
   ↓
VERIFICATION
   ↓
ANALYSE
   ↓
COMITE
   ↓
┌──────────────┬─────────────┬──────────────────┐
▼              ▼             ▼
APPROUVE      REJETE    COMPLEMENT_REQUIS
   │
   ▼
CONTRACTUALISE
   │
   ▼
DECAISSE
   │
   ▼
SUIVI
   │
   ▼
CLOTURE
```

## Fiche PME minimale

### Identité
- raison sociale
- RCCM
- NIF
- forme juridique
- date de création

### Localisation
- région
- préfecture
- commune
- adresse

### Activité
- secteur
- sous-secteur
- description
- produits et services

### Dirigeant
- nom
- prénom
- téléphone
- email

### Indicateurs
- nombre d'employés
- chiffre d'affaires
- femmes employées
- jeunes employés

### Besoin de financement
- montant demandé
- objet du financement
- apport personnel
- emplois prévus

## Cockpit Direction — indicateurs initiaux

- nombre de PME enregistrées
- dossiers en cours
- montant demandé
- montant approuvé
- montant décaissé
- taux de remboursement
- emplois créés
- répartition par région
- répartition par secteur
- performance par programme

## Hors périmètre MVP initial

Les fonctions suivantes sont prévues mais peuvent être activées en phase 2 ou nationale :

- API bancaires avancées ;
- observatoire public complet ;
- open data ;
- scoring prédictif ;
- détection de risque par IA ;
- interopérabilité gouvernementale avancée ;
- partage de données institutionnel ;
- modèles analytiques nationaux avancés.
