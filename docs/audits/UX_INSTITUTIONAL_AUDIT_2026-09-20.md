# Audit UX/UI institutionnel parallèle — FODIP Digital 2030

Date : 2026-09-20  
Base auditée : `main@02c2cdf9c44b0e37e783f1fd6b0a337c26b56415`  
Branche : `codex/ux-institutional-audit-parallel`

## 1. Objectif

Faire évoluer FODIP Digital 2030 vers une expérience institutionnelle spécifique au métier FODIP, sans régression fonctionnelle, sans réécriture du produit et sans collision avec les travaux réalisés en parallèle.

Cette branche est volontairement documentaire à ce stade : aucun composant métier, aucune règle RBAC, aucune API et aucun style de production ne sont modifiés avant validation du plan.

## 2. Ce qui doit être conservé

### Architecture et sécurité

- Next.js côté web et NestJS côté API.
- Authentification centralisée et point d'accès unique `/connexion`.
- Redirection après connexion selon les rôles autorisés.
- Vérification des sessions et habilitations côté API ; le frontend ne devient jamais l'autorité RBAC.
- MFA, journalisation, séparation des espaces métiers et traçabilité.
- États hors-ligne / connectivité et garde-fous PWA existants.
- Design system partagé dans `apps/web/app/_shared`.

### UX déjà solide

- Le portail PME place le dossier courant, son statut et la prochaine action au premier plan.
- Le cockpit Direction possède des KPI accompagnés de définitions métier et de liens vers le détail.
- Les espaces authentifiés partagent un shell cohérent avec navigation responsive.
- Les données de démonstration sont signalées explicitement lorsqu'elles sont activées.
- Les erreurs/session expirée/connectivité disposent déjà d'états dédiés.

## 3. Constats prioritaires

### P0 — Accueil public : impression de landing page générique

Fichiers :
- `apps/web/app/page.tsx`
- `apps/web/app/home.module.css`

Constats :
- Composition très standardisée : hero + grande carte latérale + grille de 7 cartes + 4 principes.
- Le titre hero atteint jusqu'à 4.65rem et donne davantage une posture de landing marketing que de portail institutionnel.
- Présence de gradients, ombres, badges, cartes répétitives et composition très symétrique.
- La phrase « Une expérience adaptée à chaque responsabilité » est trop générique et pourrait appartenir à presque n'importe quel SaaS.
- La grille par profils explique qui utilise le produit, mais pas suffisamment le fonctionnement concret du dispositif FODIP.
- Le footer expose directement `/design-system` en production.

Décision proposée :
- Conserver l'identité de marque et l'accès unique.
- Recomposer la page autour du rôle institutionnel du FODIP, du cycle réel d'un financement et des garanties de gouvernance.
- Remplacer la grille de 7 cartes par une présentation plus éditoriale et métier.
- Retirer le lien public vers le design system en production.
- Réduire le volume d'effets décoratifs et la taille du titre.

### P0 — Direction : trop de KPI au même niveau visuel

Fichier :
- `apps/web/app/direction/tableau-de-bord/page.tsx`

Point fort :
- Les indicateurs sont métier, sourcés par les données réelles et accompagnés de définitions.

Risque UX :
- Un grand nombre de `KpiCard` sont présentés au même niveau, ce qui réduit la hiérarchie exécutive.
- Des indicateurs financiers stratégiques, des volumes opérationnels et des indicateurs d'impact sont mélangés dans une même grille.

Décision proposée :
- Conserver tous les indicateurs et leurs définitions.
- Présenter d'abord un résumé exécutif limité aux indicateurs décisifs.
- Déplacer les indicateurs secondaires dans des sections structurées : portefeuille, remboursements, risque, impact, territoire.
- Donner davantage de priorité aux alertes nécessitant une décision humaine.

### P1 — Design system exposé comme page produit

Fichier :
- `apps/web/app/design-system/page.tsx`

Constat :
- La page contient des informations utiles aux développeurs, mais elle est accessible publiquement et liée depuis le footer de la page d'accueil.
- Des formulations comme « Financer avec confiance. » et la documentation des tokens sont des éléments de fabrication du produit, pas de service public.

Décision proposée :
- Conserver la route pour le développement.
- Ne plus la lier depuis les surfaces publiques.
- Conditionner son exposition selon l'environnement ou l'accès autorisé si nécessaire.

### P1 — Répétition des patterns “cards”

Fichiers concernés :
- `home.module.css`
- `RoleDashboard.module.css`
- `entrepreneur/portal.module.css`
- plusieurs pages de tableaux de bord

Constat :
- Les cartes sont utiles pour certaines données, mais sont utilisées comme structure dominante.
- Le résultat peut évoquer un kit UI générique malgré la profondeur métier réelle du projet.

Décision proposée :
- Conserver les cards pour les éléments autonomes.
- Introduire davantage de tableaux, lignes de synthèse, sections éditoriales, chronologies, listes opérationnelles, alertes et vues de détail.
- Ne pas modifier une page uniquement pour la rendre visuellement différente : la composition doit suivre la tâche métier.

### P1 — Terminologie publique encore parfois générique

Exemples :
- « Une expérience adaptée à chaque responsabilité »
- « Une continuité de gestion, de décision et de contrôle »

Décision proposée :
- Utiliser des formulations directement rattachées au cycle de financement FODIP.
- Exemple : « Gérer le cycle de financement d'une PME, du dépôt de la demande au suivi du remboursement. »
- Limiter les slogans et privilégier les faits.

## 4. Espaces métiers

### PME

État : bonne direction UX.

À conserver :
- prochaine action ;
- statut du dossier ;
- pièces manquantes ;
- workflow ;
- accès au suivi.

Amélioration :
- éviter de multiplier les KPI si l'information n'aide pas immédiatement l'entrepreneur ;
- présenter les programmes accessibles comme une liste métier plutôt qu'une nouvelle grille de cards lorsque cela améliore la lecture.

### Agent

Objectif pour la suite :
- renforcer la vue 360° dossier ;
- distinguer clairement contrôles, pièces, analyse, historique, anomalies et actions ;
- éviter une copie visuelle du cockpit Direction.

### Comité

Objectif pour la suite :
- concentrer l'écran sur les informations nécessaires à la décision ;
- garder le scoring comme aide et non comme décision ;
- rendre visibles l'historique d'instruction, les avis et la traçabilité.

### Direction

Priorité haute :
- transformer le dashboard de collection d'indicateurs en cockpit exécutif hiérarchisé ;
- synthèse nationale avant détail ;
- alertes avant analyse secondaire.

### Administration

État : cohérent et sobre.

Amélioration :
- structurer davantage autour des opérations d'administration (comptes, habilitations, MFA, journal, organisations) plutôt qu'autour d'un simple ensemble de cartes.

### Banque partenaire

Objectif :
- conserver un périmètre strictement limité aux opérations autorisées ;
- éviter de dériver visuellement du dashboard Direction.

### Auditeur

Objectif :
- rendre le caractère consultation/lecture seule explicite ;
- favoriser historique, traces et pièces justificatives.

## 5. AppShell commun

Fichier :
- `apps/web/app/_shared/AppShell.tsx`

Points forts :
- contrôle de session ;
- redirection par rôles ;
- navigation mobile ;
- recherche interne ;
- état en ligne/hors ligne ;
- lien d'évitement ;
- gestion de session expirée.

Point à vérifier lors de l'implémentation :
- le libellé de contexte de portail affiché dans le shell doit rester une information de navigation et ne pas exposer inutilement le rôle réel de l'utilisateur dans le header/menu si la règle produit impose que les rôles soient réservés à « Mon profil ».

## 6. Plan de refonte sans régression

### Lot A — Accueil public
Fichiers principalement concernés :
- `apps/web/app/page.tsx`
- `apps/web/app/home.module.css`

Actions :
1. Recomposer la page avec une hiérarchie institutionnelle.
2. Réécrire les textes génériques.
3. Réduire les cartes et effets décoratifs.
4. Conserver le bouton d'accès unique.
5. Retirer le lien public vers le design system.
6. Tester desktop, tablette et mobile.

### Lot B — Cockpit Direction
Actions :
1. Hiérarchiser les KPI existants sans supprimer de métrique.
2. Faire remonter alertes et décisions.
3. Séparer portefeuille, risque, territoires, impact et pipeline.
4. Conserver les définitions et sources de données existantes.

### Lot C — Espaces opérationnels
Ordre recommandé :
1. Agent
2. Comité
3. PME
4. Banque partenaire
5. Administration
6. Auditeur

Chaque lot doit rester indépendant pour faciliter les merges et limiter les conflits.

### Lot D — Design system / nettoyage
Actions :
- garder les primitives partagées ;
- retirer l'exposition publique du catalogue en production ;
- harmoniser les patterns réellement réutilisés ;
- supprimer uniquement les duplications confirmées.

## 7. Stratégie de travail en parallèle avec une session Work

Règles de coordination :

- Aucun commit direct sur `main`.
- Cette branche reste indépendante des branches utilisées par Work.
- Ne pas modifier simultanément les mêmes fichiers tant que les lots ne sont pas répartis.
- Avant toute implémentation, mettre cette branche à jour avec le dernier `main`.
- Si Work modifie `page.tsx`, `home.module.css`, `AppShell.tsx` ou les dashboards ciblés, rebaser puis réévaluer le lot avant d'écrire.
- Une PR par lot fonctionnel, jamais une refonte globale monolithique.
- Aucun auto-merge.
- Merge seulement lorsque CI, tests et revue sont verts.

## 8. Critères de validation avant merge

Pour chaque lot :
- lint ;
- typecheck ;
- tests unitaires pertinents ;
- tests d'intégration pertinents ;
- Playwright desktop/mobile ;
- build Next.js ;
- build API si impact ;
- vérification responsive ;
- navigation clavier/focus ;
- contrôle des permissions/RBAC ;
- absence de donnée fictive présentée comme réelle ;
- aucune modification non justifiée d'une règle métier.

## 9. Conclusion de l'audit initial

Le projet n'a pas besoin d'être reconstruit. La profondeur métier, la sécurité, les espaces par responsabilités, les workflows et la traçabilité constituent déjà une base crédible.

Le principal chantier UX est de faire correspondre l'apparence à cette profondeur : moins de codes visuels de landing SaaS, moins de répétition de cards, davantage de hiérarchie métier et un vocabulaire propre au FODIP.

Aucune implémentation visuelle ne doit commencer dans cette branche avant synchronisation avec les changements actuellement produits en parallèle et validation du découpage des lots.
