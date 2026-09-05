# Contribuer à FODIP Digital 2030

FODIP Digital 2030 est une plateforme institutionnelle en qualification. Toute contribution doit
préserver l'intégrité des données, la traçabilité des décisions et la capacité de retour arrière.

## Flux Git obligatoire

1. partir du dernier `main` ;
2. créer une branche `feat/*`, `fix/*`, `security/*`, `chore/*` ou `docs/*` ;
3. limiter la branche à un objectif vérifiable ;
4. exécuter `pnpm test:prepush` et les tests ciblés ;
5. ouvrir une pull request avec risques, preuves et statut explicites ;
6. attendre CI et CodeQL verts avant toute fusion ;
7. ne jamais pousser directement ni forcer `main`.

La protection de branche doit appliquer ces règles côté GitHub. Le document
`docs/26-CADRE-INSTITUTIONNEL.md` définit les portes d'homologation et les autorités de validation.

## Zones sensibles

Une revue renforcée est obligatoire pour :

- `.github/`, `Dockerfile`, `docker-compose*.yml`, `k8s/` et scripts de déploiement ;
- `database/` et toute évolution des règles financières ;
- authentification, autorisation, chiffrement, audit et documents ;
- collecte, conservation, export ou suppression de données personnelles ;
- calculs du cockpit Direction et indicateurs institutionnels.

## Définition de terminé

Une évolution n'est « terminée » que si :

- son besoin et ses règles sont documentés ;
- les contrôles d'accès sont appliqués côté backend ;
- les mutations sensibles sont auditées et idempotentes lorsque nécessaire ;
- les migrations sont additives et compatibles avec les données existantes ;
- les tests prouvent le succès, les refus et les cas de concurrence pertinents ;
- les états chargement, vide et erreur existent côté interface ;
- les impacts sécurité, données, exploitation et retour arrière sont renseignés ;
- aucune donnée réelle, clé ou secret n'est commité ;
- la documentation et la roadmap reflètent exactement ce qui est livré.

## Versions et production

Une fusion dans `main` ne constitue pas une mise en production. Une version n'est déployable que
si son dossier de preuve est complet et si les portes applicables du cadre institutionnel sont
validées. Les seeds de démonstration et `DEMO_MODE=true` sont interdits en PPD et PROD.
