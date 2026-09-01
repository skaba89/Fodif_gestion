# Étape 10 — Scoring et Comité de financement

## Principe de décision

Le score structure l’analyse de l’Agent mais ne décide jamais à la place du Comité. Un dossier ne peut passer à `PRET_COMITE` que si tous les critères actifs du modèle courant ont été renseignés.

Le Comité peut ensuite prononcer une décision humaine :

- `APPROUVE` ;
- `REJETE` ;
- `COMPLEMENT_REQUIS`.

Chaque décision est motivée, historisée et inscrite dans `audit_logs`.

## Modèle de scoring versionné

Le modèle Docker initial comprend quatre critères :

| Critère | Poids |
|---|---:|
| Gouvernance et capacité de gestion | 20 % |
| Solidité financière et remboursement | 30 % |
| Viabilité technique et commerciale | 30 % |
| Impact emploi et économie locale | 20 % |

Les notes sont normalisées sur 100. Les classifications initiales sont :

| Score | Risque | Recommandation |
|---:|---|---|
| 75 à 100 | FAIBLE | FAVORABLE |
| 50 à 74,99 | MODERE | FAVORABLE_SOUS_CONDITIONS |
| moins de 50 | ELEVE | DEFAVORABLE |

Ces seuils produisent une recommandation explicable. Ils ne provoquent aucune transition automatique du dossier.

## Sécurité et concurrence

- seul l’Agent affecté peut calculer le score ;
- le dossier doit être `EN_INSTRUCTION` ;
- chaque critère doit être fourni exactement une fois ;
- une note ne peut dépasser le maximum du critère ;
- le passage vers le Comité vérifie en base la complétude du score ;
- une décision n’est acceptée que depuis `PRET_COMITE` ;
- une mise à jour concurrente est refusée par une transition conditionnelle atomique ;
- le montant approuvé ne peut dépasser le montant demandé ;
- la décision, l’historique et l’audit sont écrits dans une même requête transactionnelle.

## Interfaces

### Agent

La fiche `/agent/dossiers/:id` affiche le modèle actif, les critères, les justifications, le score total, le niveau de risque et la recommandation.

### Comité

Routes principales :

- `/comite/connexion` ;
- `/comite/dossiers` ;
- `/comite/dossiers/:id`.

La fiche décisionnelle présente le projet, le score détaillé, les pièces et les décisions précédentes avant de permettre l’approbation, le rejet ou la demande de complément.

## Validation Docker

Le smoke test CI exécute le cycle réel suivant :

1. connexion Agent ;
2. prise en charge d’un dossier ;
3. calcul des quatre critères ;
4. passage à `PRET_COMITE` ;
5. connexion Comité ;
6. décision d’approbation ;
7. contrôle du statut et de la décision persistée ;
8. dépôt et téléchargement d’un document dans MinIO.
