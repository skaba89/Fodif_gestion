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


## 10. Audit détaillé par espace métier

### 10.1 Agent — tableau de bord et file d’instruction

Fichiers examinés :
- `apps/web/app/agent/tableau-de-bord/page.tsx`
- `apps/web/app/agent/dossiers/page.tsx`
- `apps/web/app/agent/dossiers/[id]/page.tsx`

État actuel : **fonctionnellement très solide**.

Points à conserver :
- séparation explicite entre « À prendre », « Mes dossiers », « Compléments », « Prêts comité » et « Historique » ;
- filtrage du périmètre Agent côté serveur ;
- prise en charge d’un dossier avant instruction ;
- vue prioritaire avec prochaine action ;
- fiche dossier 360° ;
- vérification des pièces sans quitter la fiche ;
- journal d’instruction ;
- scoring explicable avec justification par critère ;
- rappel explicite que le score n’est qu’une aide et ne décide pas à la place du comité ;
- confirmation avant décision d’instruction ;
- gestion explicite de l’absence de connectivité pour les actions sensibles.

Constats UX :
- le dashboard Agent est déjà mieux orienté « travail à faire » qu’un dashboard SaaS générique ;
- la fiche 360° est l’un des écrans les plus différenciants du produit et ne doit pas être simplifiée en grille de cartes ;
- la répétition de composants visuels génériques doit rester secondaire par rapport à la logique de poste d’instruction ;
- le statut technique brut affiché à côté du badge métier dans la fiche dossier peut être utile au support, mais doit être réévalué pour l’utilisateur métier s’il duplique l’information sans valeur opérationnelle.

Évolution recommandée :
- préserver l’architecture actuelle ;
- renforcer la hiérarchie « action à faire → informations nécessaires → scoring → décision → historique » ;
- transformer les informations secondaires en zones compactes plutôt qu’en nouvelles cartes ;
- conserver la fiche dossier comme référence UX pour les autres espaces opérationnels.

### 10.2 Comité — ordre du jour et décision

Fichiers examinés :
- `apps/web/app/comite/tableau-de-bord/page.tsx`
- `apps/web/app/comite/dossiers/page.tsx`
- `apps/web/app/comite/dossiers/[id]/page.tsx`

État actuel : **bonne séparation métier et bonne gouvernance de la décision humaine**.

Points à conserver :
- ordre du jour distinct de l’historique ;
- priorité par ancienneté, score ou montant sans transformer ce tri en décision automatique ;
- mise en avant des dossiers à risque élevé ;
- score détaillé et explicable ;
- modèle et version de scoring visibles ;
- pièces et chronologie visibles avant la décision ;
- décision finale explicitement humaine ;
- confirmation explicite avant enregistrement irréversible ;
- décision auditée ;
- possibilité d’imprimer une synthèse.

Constats UX :
- le tableau de bord est pertinent mais reste construit avec le même langage KPI/card que les autres portails ;
- la page décisionnelle contient l’information nécessaire mais peut être hiérarchisée davantage comme un « dossier de séance » ;
- les éléments les plus importants avant décision sont : synthèse PME, montant demandé, apport, risque, justification du score, pièces, historique d’instruction, puis formulaire de décision ;
- l’impression de synthèse est cohérente avec un usage institutionnel et doit être conservée.

Évolution recommandée :
- faire de la fiche Comité un véritable dossier décisionnel lisible de haut en bas ;
- distinguer visuellement « faits », « analyse », « traçabilité » et « décision » ;
- limiter les cartes décoratives ;
- ne jamais mettre le score dans une position qui pourrait suggérer une décision automatique.

### 10.3 PME — portail entrepreneur

Fichier examiné :
- `apps/web/app/entrepreneur/page.tsx`

État actuel : **très bonne orientation utilisateur**.

Points à conserver :
- dossier courant visible immédiatement ;
- statut actuel ;
- workflow Dossier → Instruction → Décision → Financement → Suivi ;
- prochaine action explicite ;
- nombre de pièces manquantes ;
- accès direct aux documents manquants ;
- historique et tous les dossiers disponibles sans polluer l’action principale ;
- absence de faux KPI marketing.

Constats UX :
- le portail répond déjà aux questions essentielles d’une PME ;
- « Vue d’ensemble » et « Programmes accessibles » sont secondaires par rapport au dossier courant, ce qui est la bonne hiérarchie ;
- les programmes ouverts sont encore présentés sous forme de cards et peuvent évoluer vers une présentation plus sobre si leur nombre augmente.

Évolution recommandée :
- ne pas refondre la logique principale ;
- simplifier encore les éléments secondaires ;
- conserver un langage non administratif lorsque ce n’est pas nécessaire ;
- maintenir la prochaine action comme premier élément décisionnel.

### 10.4 Direction — cockpit et gestion des financements

Fichiers examinés :
- `apps/web/app/direction/tableau-de-bord/page.tsx`
- `apps/web/app/direction/financements/page.tsx`
- `apps/web/app/direction/financements/[id]/page.tsx`

État actuel : **profondeur métier élevée, hiérarchie exécutive à améliorer**.

Points à conserver :
- indicateurs financiers calculés à partir de données réelles ;
- définitions des KPI ;
- filtres et périmètres ;
- lecture territoriale ;
- ventilation par programmes, secteurs et banques ;
- suivi des décaissements, remboursements, échéances et impact ;
- journal d’audit ;
- idempotence sur les opérations financières sensibles.

Constats UX :
- trop d’indicateurs sont placés au même niveau dans la première lecture ;
- la Direction a besoin d’une lecture « situation → risques/alertes → décisions → détail », plutôt que d’un catalogue de KPI ;
- la fiche financement mélange volontairement beaucoup de fonctions opérationnelles : contrat, décaissements, remboursements, impact, historique et audit ;
- cette richesse est utile, mais la composition doit distinguer clairement pilotage, exécution financière et preuve d’audit.

Point de gouvernance à valider avant toute évolution :
- la Direction peut actuellement déclencher certaines opérations financières dans sa fiche financement. Ne modifier ni étendre cette capacité sans validation des règles métier et RBAC existantes ; l’audit UX n’en déduit aucune règle nouvelle.

Évolution recommandée :
- un bandeau exécutif court : montant accordé, décaissé, encours, impayés/taux de remboursement et alertes ;
- sections séparées pour pipeline, territoires, programmes/secteurs, partenaires et impact ;
- la vue détaillée d’un financement doit privilégier d’abord la position financière et les échéances, puis les actions autorisées et enfin l’historique.

### 10.5 Banque partenaire

Fichiers examinés :
- `apps/web/app/partenaire/financements/page.tsx`
- `apps/web/app/partenaire/financements/[id]/page.tsx`

État actuel : **périmètre bancaire distinct et contrôlé**.

Points à conserver :
- uniquement les financements du périmètre de l’établissement ;
- accès à l’échéancier ;
- déclaration des opérations autorisées ;
- idempotence des déclarations sensibles ;
- tableau opérationnel plutôt qu’un dashboard décoratif.

Constat important :
- les KPI « Montant accordé », « Taux moyen » et « Durée moyenne » sont calculés sur les éléments de la **page courante**, et leurs définitions l’indiquent.
- visuellement, un décideur peut toutefois les interpréter comme des totaux du portefeuille si la mention « page courante » n’est pas immédiatement visible.

Évolution recommandée :
- soit fournir de vrais agrégats de portefeuille via l’API si le besoin métier existe ;
- soit renommer visiblement les métriques pour indiquer qu’elles portent uniquement sur la page affichée ;
- ne jamais présenter un sous-total paginé comme un KPI global.

### 10.6 Administration

Fichiers examinés :
- `apps/web/app/administration/tableau-de-bord/page.tsx`
- `apps/web/app/administration/utilisateurs/page.tsx`
- `apps/web/app/administration/journal/page.tsx`

État actuel : **fonctionnel, sécurisé, mais dense**.

Points à conserver :
- comptes actifs/inactifs ;
- MFA exigé ;
- comptes jamais connectés ;
- rattachement PME / banque partenaire ;
- journal d’audit ;
- protections contre certaines actions critiques ;
- confirmations sur opérations sensibles.

Constats UX :
- la page utilisateurs rassemble création des référentiels, création de comptes, rôles, rattachements, MFA et actions de cycle de vie : cela peut devenir très dense ;
- le badge « Accès SUPER_ADMIN · actions journalisées » expose un code de rôle technique dans l’en-tête de contenu ;
- cette information doit être réévaluée au regard de la règle produit qui réserve l’identité/les rôles de compte à l’espace profil et évite d’exposer inutilement des codes techniques dans l’interface principale.

Évolution recommandée :
- séparer visuellement « Organisations », « Comptes & habilitations », « Sécurité/MFA » et « Journal » ;
- remplacer les codes techniques visibles par des libellés métier lorsqu’ils n’apportent rien à l’administrateur ;
- ne jamais masquer les contrôles de sécurité réels : seul leur rendu doit être humanisé.

### 10.7 Auditeur

Fichier examiné :
- `apps/web/app/auditeur/tableau-de-bord/page.tsx`

État actuel : **bonne séparation lecture seule**.

Points à conserver :
- aucune action de création/modification ;
- portefeuille de financements ;
- journal d’audit ;
- filtres par type d’entité ;
- auteur, action, entité et date ;
- présentation explicite du caractère « contrôle indépendant ».

Constat important :
- comme pour la Banque partenaire, les montants accordés/décaissés/impayés affichés en synthèse sont calculés sur la **page courante** des financements.
- la définition l’indique, mais le traitement visuel reste celui d’un KPI de synthèse.

Évolution recommandée :
- privilégier les preuves, la traçabilité et les écarts plutôt qu’une esthétique de cockpit ;
- rendre extrêmement explicite tout agrégat basé sur une page paginée ;
- si des agrégats globaux sont nécessaires, les calculer côté serveur et les distinguer des données de la page.

## 11. Matrice de priorité issue de l’audit détaillé

| Priorité | Zone | Action recommandée | Risque fonctionnel |
| --- | --- | --- | --- |
| P0 | Accueil public | Recomposition institutionnelle + textes métier + retrait du lien public design system | Faible si routes conservées |
| P0 | Direction | Hiérarchie exécutive des KPI et alertes | Moyen : préserver calculs/filtres |
| P1 | Administration | Dé-densifier et humaniser les codes de rôle visibles | Moyen : ne pas toucher aux contrôles RBAC |
| P1 | Banque partenaire | Clarifier agrégats « page courante » vs portefeuille | Faible à moyen selon évolution API |
| P1 | Auditeur | Clarifier agrégats paginés et renforcer lecture preuve/audit | Faible à moyen selon évolution API |
| P2 | Comité | Hiérarchiser le dossier de séance, sans changer la décision | Faible |
| P2 | Agent | Polir la fiche 360° sans changer le workflow | Faible |
| P2 | PME | Simplification secondaire uniquement | Faible |

## 12. Découpage recommandé pour le travail parallèle

Pour limiter les conflits avec la session Work, ne pas démarrer plusieurs lots touchant les mêmes primitives partagées.

Ordre sûr recommandé :

1. **PR A — Accueil public uniquement**  
   `page.tsx` + `home.module.css` + condition d’exposition du lien design system.

2. **PR B — Direction uniquement**  
   cockpit et hiérarchie des vues ; aucune modification des règles financières.

3. **PR C — Administration + Auditeur + Banque partenaire**  
   uniquement après relecture des changements Work éventuels sur composants partagés.

4. **PR D — Agent + Comité + PME**  
   polissage ciblé, car leurs logiques métier sont déjà convaincantes.

Avant chaque PR :
- récupérer le dernier `main` ;
- comparer les fichiers modifiés par Work ;
- abandonner ou réécrire tout patch qui entrerait en collision ;
- conserver des PR petites et réversibles.
