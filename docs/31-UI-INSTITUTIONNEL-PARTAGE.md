# 31 — UI institutionnelle partagée

## Statut

Lot en qualification sur la branche `feat/institutional-shared-ui`.

Ce document complète `docs/14-ROADMAP-SAAS-PREMIUM.md` et `docs/23-PRESENTATION-DIRECTION-GENERALE.md` sans modifier leur statut d'homologation. L'axe E3 reste **partiel** tant que les assistants guidés PME / Agent / Comité / Direction ne sont pas livrés.

## Objectif

Finaliser le socle de composants UI mutualisés de FODIP Digital 2030, sans toucher aux règles métier, aux calculs financiers, au RBAC, au MFA, aux migrations ni aux endpoints métier.

## Composants livrés dans ce lot

- `Button` : variantes primary, secondary, outline, ghost et destructive ; états loading/disabled ; lien ou bouton ; cible tactile minimale de 44 px ;
- `Toast` : succès, information, avertissement et erreur ; fermeture manuelle ; durée configurable ; empilement ; rôles ARIA ; filtrage défensif des détails techniques ou secrets évidents ;
- `Dialog` : fenêtre modale générique accessible avec focus trap, Escape, blocage du scroll et retour du focus ;
- `FilterBar` / `FilterField` : filtres mutualisés, compteur de filtres actifs, reset et zone d'actions ;
- `Breadcrumbs` : fil d'Ariane accessible et compact sur mobile ;
- `ResponsiveTable` : tableau sémantique sur écran large et cartes libellées sur mobile, sans masquer de colonne.

Les composants déjà existants restent préservés : `AppShell`, `AccountMenu`, `Drawer`, `KpiCard`, `ExecutiveAlert`, `ConfirmDialog`, `Skeleton`, `EmptyState`, `ErrorState` et `Pagination`.

## Première adoption réelle

Le lot adopte les nouveaux composants sur un périmètre volontairement limité :

- `/direction/financements` : `Breadcrumbs`, `Button`, `ResponsiveTable`, feedback `Toast` ;
- `/agent/dossiers` : `Breadcrumbs`, `Button`, `FilterBar`, `ResponsiveTable` ;
- `/entrepreneur/suivi` : `Breadcrumbs`, `Button`, `FilterBar`, `ResponsiveTable`, feedback `Toast`.

Les appels API, calculs, statuts métier, pagination et règles de sécurité de ces écrans restent inchangés.

## Design system

`/design-system` présente désormais un catalogue interactif des composants partagés :

- Button ;
- Toast ;
- Dialog ;
- ConfirmDialog ;
- FilterBar ;
- Breadcrumbs ;
- ResponsiveTable ;
- KpiCard ;
- ExecutiveAlert ;
- Skeleton ;
- EmptyState ;
- ErrorState ;
- Drawer.

Les données présentées sur cette page sont explicitement des spécimens d'interface, pas des données métier réelles.

## Responsive et accessibilité

Le test `apps/web/e2e/shared-ui.spec.ts` couvre notamment :

- Button disabled/loading ;
- Dialog : ouverture, focus initial, Escape et retour du focus ;
- Toast : annonce et fermeture ;
- FilterBar : compteur et reset ;
- ResponsiveTable : conservation de tous les libellés/valeurs en vue mobile ;
- absence de débordement horizontal de page à 360, 390, 768, 1024 et 1440 px.

La page `/design-system` reste également couverte par le scan WCAG automatisé existant dans `apps/web/e2e/accessibility.spec.ts`.

## Limites et suite E3

Ce lot ne constitue pas la clôture de l'axe E3. Restent notamment :

- assistants guidés / wizards pour PME, Agent, Comité et Direction ;
- migration progressive des autres tableaux et barres de filtres existants vers les composants partagés, écran par écran, sans big-bang ;
- recette d'accessibilité avec technologies d'assistance réelles lorsque l'environnement de qualification le permet.

Aucun de ces points ne doit être déclaré « Fait » sur la seule base de ce lot.
