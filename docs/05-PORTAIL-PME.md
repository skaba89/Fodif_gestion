# Étape 5 — Portail PME

## Objectif

Donner à une PME un espace simple pour préparer son profil, constituer une demande de financement et suivre son traitement.

## Routes livrées

- `/entrepreneur` — tableau de bord PME
- `/entrepreneur/entreprise` — fiche entreprise
- `/entrepreneur/demande` — assistant de demande de financement
- `/entrepreneur/suivi` — suivi et historique des dossiers

## Fonctionnalités UX

### Tableau de bord
- progression du dossier ;
- référence PME ;
- parcours de complétude ;
- programmes de financement accessibles ;
- raccourcis vers les actions principales.

### Fiche entreprise
- identité légale ;
- RCCM / NIF ;
- forme juridique ;
- activité ;
- localisation ;
- effectif ;
- contacts.

### Demande de financement
Assistant en cinq étapes :
1. programme et besoin ;
2. projet et budget ;
3. impact attendu ;
4. documents ;
5. vérification avant soumission.

La première maquette affichait une checklist documentaire. Depuis l’étape 8, le téléversement réel utilise un stockage privé via une API S3 compatible.

### Suivi
- liste des dossiers ;
- statut courant ;
- historique de traitement ;
- prochaine étape ;
- absence d'action requise signalée clairement.

## Sécurité et données

Le portail est connecté à l'API NestJS, PostgreSQL, au RBAC et au stockage documentaire privé. L'entreprise autorisée provient du JWT ; un identifiant d'entreprise fourni par le navigateur ne peut pas élargir le périmètre. Les données synthétiques sont limitées au mode local et ne doivent jamais être chargées en production.
