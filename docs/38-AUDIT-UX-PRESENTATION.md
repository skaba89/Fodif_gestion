# Étape 38 — Audit UX et présentation institutionnelle

## Objectif

Uniformiser la présentation de FODIP Digital 2030 sur l'ensemble des espaces sans modifier les règles métier, les API, les permissions ni les données officielles.

Le principe retenu est simple : la plateforme doit donner la même impression de maîtrise institutionnelle quel que soit le profil utilisé pendant une démonstration — PME, Agent, Comité, Direction, Administration, Auditeur ou Partenaire bancaire.

## Périmètre audité

L'audit couvre les familles de pages exposées par l'application web :

- accueil public et connexion unifiée ;
- espace PME : accueil, entreprise, programmes, nouvelle demande, suivi et documents ;
- espace Agent : portefeuille de dossiers, détail d'instruction et programmes ;
- espace Comité : séance décisionnelle, détail d'un dossier et programmes ;
- espace Direction : cockpit, programmes, financements et rapprochements ;
- espace Administration : utilisateurs, rôles et sécurité des comptes ;
- espace Auditeur : portefeuille et journal d'audit ;
- espace Partenaire bancaire : financements et opérations autorisées ;
- composants partagés : shell, navigation, KPI, tableaux, filtres, états vides, boutons, badges, fil d'Ariane et thèmes.

## Diagnostic

### Socle déjà mature

Le shell applicatif est déjà au niveau attendu : identité FODIP, navigation active, menu mobile, thème sombre, focus clavier, bannière de démonstration et réduction des animations sont partagés entre les portails.

Les espaces Direction et Administration utilisent déjà les composants les plus aboutis : `Breadcrumbs`, `FilterBar`, `KpiCard`, `ResponsiveTable`, `EmptyState`, `ErrorState`, boutons et notifications.

L'espace PME dispose aussi d'une bonne hiérarchie et d'un vocabulaire métier plus lisible, notamment pour les statuts de dossier.

### Écarts observés

Plusieurs écrans historiques restaient construits avec des tableaux HTML et cartes KPI ad hoc : Comité, Partenaire bancaire et Auditeur. Cela créait des différences de densité, de responsive et de hiérarchie visuelle selon le rôle.

L'écran Agent utilisait déjà le tableau responsive mais affichait encore les codes techniques de workflow directement (`SOUMIS`, `EN_INSTRUCTION`, `PRET_COMITE`, etc.) au lieu des libellés métier partagés.

Les badges historiques utilisaient souvent la même teinte quelle que soit la signification. Un risque faible, une validation, une attente ou un rejet pouvaient donc manquer de différenciation visuelle.

La page d'accueil publique répétait le même lien de connexion sur chaque rôle alors que l'authentification est désormais unifiée. La première impression ressemblait davantage à un sélecteur de portails qu'à une plateforme institutionnelle intégrée.

## Décisions de design

### 1. Un vocabulaire de statut partagé

Le composant `StatusBadge` fournit cinq tonalités sémantiques :

- neutre ;
- information ;
- vigilance ;
- succès ;
- danger.

`DossierStatusBadge` réutilise directement `dossierStatusLabel` et `dossierStatusTone` afin d'éviter toute divergence entre PME, Agent et futurs écrans.

`RiskBadge` distingue explicitement risque faible, moyen et élevé. Les valeurs brutes restent accessibles via l'attribut `title` lorsque cela facilite le diagnostic technique.

### 2. KPI homogènes

Les écrans de synthèse migrés utilisent `KpiCard` plutôt que des cartes spécifiques à chaque portail.

Chaque KPI indique ce qu'il mesure. Lorsqu'un montant ou un nombre est calculé uniquement avec les lignes de la page courante, sa définition le précise afin de ne pas présenter un sous-total paginé comme un total global.

Aucune tendance n'est inventée : le composant conserve son état « tendance non disponible » lorsqu'aucune comparaison n'est réellement calculée par l'API.

### 3. Tableaux responsive par défaut

Les listes structurées doivent privilégier `ResponsiveTable` :

- table sémantique sur écran large ;
- carte lisible sur mobile ;
- caption accessible ;
- état vide partagé ;
- actions conservées dans le contexte de chaque ligne.

Le style partagé renforce la séparation des en-têtes, le survol desktop, la lisibilité des libellés et l'identité des cartes mobiles sans changer le contenu.

### 4. Hiérarchie de page commune

Une page métier de référence suit désormais cette séquence :

```text
Fil d'Ariane
→ Eyebrow métier
→ H1 unique
→ phrase d'objectif
→ KPI si la page est une synthèse
→ filtres si nécessaires
→ titre de section + explication
→ contenu principal
→ pagination / actions
```

Cette hiérarchie évite que les tableaux ou formulaires apparaissent immédiatement sans contexte.

### 5. Accueil public orienté mission

L'accueil public présente désormais :

```text
Mission nationale
→ accès unique
→ chaîne Dossier / Instruction / Décision / Financement / Suivi
→ responsabilités par rôle
→ principes de confiance
```

Les cartes de rôles ne répètent plus sept fois la même action de connexion. Elles expliquent les responsabilités tandis qu'un CTA principal mène vers le point d'accès unifié.

Aucun nombre de PME, montant financé, taux de remboursement ou impact n'est affiché sans donnée réelle.

## Écrans directement harmonisés dans ce lot

### Agent — Dossiers

- KPI partagés ;
- statuts lisibles et sémantiques ;
- filtres reformulés ;
- section « File d'instruction » ;
- maintien de la vue 360° et de la pagination existantes.

### Comité — Séance décisionnelle

- fil d'Ariane ;
- KPI partagés ;
- tableau responsive ;
- badge de risque ;
- action « Examiner » cohérente ;
- état vide partagé.

### Partenaire bancaire — Financements

- fil d'Ariane ;
- synthèse du portefeuille ;
- montant, taux et durée calculés uniquement à partir des données disponibles ;
- tableau responsive ;
- statut sémantique ;
- accès au détail inchangé.

### Auditeur — Supervision

- fil d'Ariane ;
- KPI partagés ;
- portefeuille responsive ;
- filtre de journal standardisé ;
- actions et types d'entités rendus lisibles ;
- identifiants techniques abrégés visuellement mais conservés en `title` ;
- espace toujours strictement en lecture seule.

## Pages conservées sans refonte lourde

Les pages Direction, Administration et les principaux écrans PME avaient déjà adopté les composants premium. Le lot évite de les réécrire pour le simple plaisir de changer du code : elles bénéficient automatiquement des améliorations de composants partagés lorsqu'elles les utilisent.

Les écrans de détail métier restent centrés sur leur workflow existant ; leur logique n'est pas déplacée ou restructurée dans ce lot afin de limiter le risque de régression avant l'homologation pilote.

## Responsive et accessibilité

Les composants modifiés respectent :

- un seul titre principal par page ;
- navigation structurée avec fil d'Ariane ;
- tables avec caption ;
- labels de filtres reliés aux champs ;
- contrastes reposant sur les tokens clair/sombre existants ;
- statut non communiqué par la couleur seule : chaque badge contient toujours un libellé texte ;
- réduction des animations via `prefers-reduced-motion` ;
- mise en page mobile sans obligation de tableau horizontal pour les listes migrées.

## Garde-fous fonctionnels

Ce lot ne modifie pas :

- le RBAC ;
- MFA, OIDC ou JWT ;
- les endpoints API ;
- les calculs financiers backend ;
- les règles d'éligibilité ;
- le versioning des programmes ;
- les transitions de dossier ;
- les migrations PostgreSQL ;
- les données de démonstration ou les valeurs officielles FODIP.

Les quelques agrégats ajoutés à l'interface sont des calculs de présentation sur les lignes déjà renvoyées par l'API et sont explicitement décrits comme tels.

## Critères de validation

La PR de présentation ne doit être fusionnée que si :

1. lint et invariants institutionnels sont verts ;
2. build API et Web sont verts ;
3. tests unitaires et intégration PostgreSQL/MinIO sont verts ;
4. CodeQL et contrôles de sécurité sont verts ;
5. Docker/Playwright termine sans régression ;
6. les parcours existants de connexion et de navigation par rôle restent fonctionnels.

## Suite recommandée après validation

Après ce lot, l'amélioration visuelle doit rester incrémentale. Les prochains changements de présentation devraient viser les écrans de détail réellement observés comme difficiles pendant les recettes métier plutôt que lancer une nouvelle refonte globale. L'objectif prioritaire reste l'homologation pilote et la stabilité des parcours.
