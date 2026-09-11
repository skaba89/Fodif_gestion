# FODIP Digital 2030 — Design system & UX institutionnelle

## 1. Intention produit

FODIP Digital 2030 doit fonctionner comme une institution financière numérique, pas comme une juxtaposition de portails. La même identité visuelle et les mêmes primitives d’interaction s’appliquent désormais à la connexion, aux sept espaces métiers et au design system vivant.

Principes directeurs :

- **Action attendue avant information de contexte**, puis détail consultable.
- **Autorité sans lourdeur** : vert profond institutionnel, ivoire, typographie dense mais lisible, micro-interactions sobres.
- **Confiance B2G** : confirmation des transitions sensibles, états explicites, horodatage visible quand la donnée existe, aucune action silencieuse hors ligne.
- **Mobile d’abord pour la PME**, desktop dense pour les agents, sans casser l’un ou l’autre usage.
- **Dégradation sûre** : un réseau instable ne doit jamais faire croire qu’une mutation financière a été enregistrée si elle ne l’a pas été.

## 2. Tokens de marque

| Rôle | Token | Valeur |
|---|---|---|
| Vert primaire | `--fodip-primary` | `#14532D` |
| Vert accent | `--fodip-accent` | `#16A34A` |
| Or, actions clés uniquement | `--fodip-gold` | `#F5B700` |
| Fond ivoire | `--fodip-ivory` | `#FAF9F6` |
| Texte principal | `--fodip-text` | `#1A2E22` |
| Succès | `--success` / `--success-soft` | sémantique clair/sombre |
| Information | `--info` / `--info-soft` | sémantique clair/sombre |
| Attention | `--warning` / `--warning-soft` | sémantique clair/sombre |
| Critique | `--danger` / `--danger-soft` | sémantique clair/sombre |

Le thème sombre ne remplace pas la hiérarchie de marque : il remappe les rôles sémantiques avec un contraste adapté. L’or reste associé à un texte sombre lorsqu’il sert de fond.

### Typographie

- **Public Sans** : titres, chiffres clés, messages institutionnels. Elle prolonge la grotesque déjà utilisée par la landing.
- **Inter** : corps, formulaires, tableaux et données denses.
- Chiffres financiers : `font-variant-numeric: tabular-nums lining-nums`.
- Les deux familles passent par `next/font` et sont donc embarquées au build, sans dépendance runtime à un CDN.

### Mouvement

- Durée par défaut : **220 ms**.
- Courbe : ease-out produit `cubic-bezier(0.16, 1, 0.3, 1)`.
- `prefers-reduced-motion` réduit animations et transitions.
- Les états d’attente utilisent des **skeletons ou barres linéaires**, jamais des spinners circulaires.

## 3. Catalogue partagé — 16 composants

1. `Button`
2. `StatusBadge` / `DossierStatusBadge`
3. `WorkflowStepper`
4. `ResponsiveTable`
5. `FilterBar`
6. `KpiCard`
7. `Toast`
8. `Dialog`
9. `ConfirmDialog`
10. `Breadcrumbs`
11. `Skeleton`
12. `EmptyState`
13. `ErrorState`
14. `ExecutiveAlert`
15. `Drawer`
16. `ConnectivityBanner`

Le catalogue interactif est disponible dans `/design-system` et importe les composants réels de `apps/web/app/_shared`.

## 4. Écrans livrés et justification UX

### Connexion — 1440 px

Le formulaire reste dans la zone de lecture principale tandis que le panel vert établit immédiatement l’identité FODIP, la mission et les chiffres de confiance. Le SSO devient secondaire visuellement et les erreurs restent attachées au champ concerné, ce qui réduit la confusion dans un contexte d’accès sécurisé.

### Connexion — 375 px

Le panel de mission devient un bandeau compact au-dessus du formulaire afin de préserver l’autorité de marque sans repousser l’email et le mot de passe sous la ligne de flottaison. Les champs et actions conservent des cibles tactiles confortables et la session expirée reste un message inline compact.

### App shell — 1440 px

La sidebar de 260 px donne une navigation stable par rôle, avec contexte de sécurité et compte en bas ; la barre haute concentre recherche rapide, notifications, thème et état réseau. Un agent ou décideur n’a plus besoin d’ouvrir un menu avant de passer d’un espace de travail à un autre.

### App shell — 375 px

La navigation devient une bottom-nav de quatre entrées contextuelles plus « Plus », avec `env(safe-area-inset-bottom)` et cibles ≥ 44 px. Le tiroir conserve l’intégralité de l’arborescence sans surcharger l’écran principal.

### Dashboard PME — 1440 / 375 px

Le dossier actif, son statut, le stepper Dossier → Instruction → Décision → Financement → Suivi et la **prochaine action** précèdent tous les KPI. La PME peut donc comprendre sa situation immédiatement après connexion ; les pièces manquantes sont remontées depuis les données réelles de l’API, et non simulées dans l’interface.

### Dashboard Agent — 1440 / 375 px

La file d’instruction est triée par priorité métier puis ancienneté, avec un CTA direct vers le prochain dossier. Pour un dossier non attribué, **« Prendre et instruire » regroupe la prise en charge et l’ouverture en une seule interaction**, alors que le parcours précédent demandait d’ouvrir puis de prendre en charge sur la page détail.

### Poste d’instruction Agent — 1440 px

La synthèse entreprise/financement, les pièces, le scoring et la décision sont visibles dans un même workspace, avec un rail de décision persistant. Le design élimine les allers-retours entre zones de page et garde le journal horodaté à portée de consultation.

### Poste d’instruction Agent — 375 px

Le rail redevient un flux vertical ordonné : synthèse, pièces, scoring, décision et journal. La hiérarchie reste identique au desktop et aucune fonction critique n’est masquée dans un hover ou une interaction uniquement souris.

### Direction

Le cockpit existant était déjà structuré autour des alertes, KPI, tendances, ventilations régionales/sectorielles/bancaires et données fraîches. Il hérite du nouveau shell, des tokens et de la typographie sans réécriture fonctionnelle risquée ; les alertes exécutives restent avant le détail du portefeuille.

### Partenaire bancaire

Le portefeuille partenaire conserve son périmètre RBAC, ses KPI et l’accès aux échéanciers/opérations via chaque financement. Il bénéficie du shell unifié et des mêmes règles de statut/tableau ; une évolution métier séparée sera nécessaire si le FODIP souhaite exposer une vraie file « opérations prévues » agrégée, car l’API actuelle ne fournit pas ce concept au niveau liste.

## 5. Réduction des clics Agent

### Avant — entrée dans un nouveau dossier non attribué

1. repérer/rechercher le dossier ;
2. ouvrir « Vue 360° » ;
3. cliquer « Prendre en charge » ;
4. rejoindre les zones scoring/décision par défilement.

### Après

1. le prochain dossier est proposé automatiquement en tête de file ;
2. cliquer **« Prendre et instruire »** : l’API de claim est appelée puis le poste d’instruction s’ouvre déjà attribué ;
3. scoring et décision sont dans le même workspace, avec rail persistant.

Sur le sous-parcours critique « file → dossier attribué prêt à être instruit », la navigation passe de **2 actions à 1**, soit **50 % de clics en moins**. Le test E2E du cycle complet verrouille ce comportement.

## 6. Résilience PWA et sécurité

Le service worker conserve une stratégie volontairement prudente :

- cache du shell, du manifest, des icônes et assets immuables ;
- navigation network-first avec page `/hors-ligne` en secours ;
- **aucun cache générique des réponses `/api`** contenant dossiers, données financières ou PII ;
- bannière de perte/rétablissement de connexion ;
- mutations sensibles désactivées hors ligne ;
- validation de pièce optimiste uniquement lorsqu’un réseau est présent, avec rollback en cas d’échec serveur.

Le cahier des charges demande le cache hors-ligne de dossiers consultés. Cette capacité **ne doit pas** être ajoutée avec Cache Storage générique : sur appareils partagés, elle risquerait d’exposer le dossier d’un utilisateur après changement de session. Une phase dédiée devra utiliser un stockage local chiffré, versionné et partitionné par utilisateur/session, avec stratégie d’effacement explicite à la déconnexion.

## 7. Performance 3G et appareils modestes

Mesures déjà appliquées :

- pas de bibliothèque d’icônes supplémentaire ; SVG inline minimal ;
- polices gérées au build par Next ;
- aucun ajout de framework CSS supplémentaire ;
- pagination serveur à 25 lignes sur les files Agent et Partenaire, donc aucun rendu de tableau >100 lignes ;
- animations réduites ;
- service worker léger et sans Workbox ;
- suppression d’une recharge réseau de la file Agent à chaque frappe : requête uniquement lors de l’application du filtre ou de la pagination.

Le **LCP < 2,5 s** reste un objectif mesurable et non une affirmation : il doit être contrôlé sur le build déployé sous profil réseau/mobile réel ou Lighthouse CI avant validation de production.

## 8. Accessibilité

- `<html lang="fr">`.
- Focus visible et lien d’évitement.
- `aria-current` pour navigation et stepper.
- Tableaux sémantiques / cartes mobiles.
- Dialogues avec gestion du focus.
- Messages `role="status"` / `role="alert"` selon criticité.
- Navigation 1440 px et 375 px testée dans Playwright.
- Axe conserve les règles WCAG 2.0/2.1 et ajoute les règles WCAG 2.2 AA supportées par la version installée.
- Le statut n’est jamais communiqué par couleur seule.

## 9. Pourquoi le lot n’introduit pas Tailwind

Le projet Web existant n’utilise pas Tailwind : sa couche UI est construite avec CSS Modules, tokens globaux et composants React partagés. Ajouter Tailwind uniquement pour ce redesign créerait deux mécanismes concurrents, augmenterait le CSS/build et rendrait l’harmonisation plus fragile.

Le livrable est donc **React réutilisable + tokens/CSS Modules natifs à la base existante**. Les composants (`Button`, `WorkflowStepper`, `StatusBadge`, `AppShell`, etc.) gardent une API indépendante du moteur CSS ; une migration Tailwind ultérieure pourrait remplacer l’implémentation visuelle sans modifier leurs contrats React.

## 10. Fichiers structurants

- `apps/web/app/fodip-product-theme.css`
- `apps/web/app/layout.tsx`
- `apps/web/app/_shared/LoginForm.tsx`
- `apps/web/app/_shared/AppShell.tsx`
- `apps/web/app/_shared/ConnectivityBanner.tsx`
- `apps/web/app/_shared/WorkflowStepper.tsx`
- `apps/web/app/_shared/RoleDashboard.module.css`
- `apps/web/app/entrepreneur/page.tsx`
- `apps/web/app/agent/dossiers/page.tsx`
- `apps/web/app/agent/dossiers/[id]/page.tsx`
- `apps/web/app/design-system/page.tsx`
- `apps/web/e2e/login.spec.ts`
- `apps/web/e2e/accessibility.spec.ts`
- `apps/web/e2e/workflow.spec.ts`

## 11. Critères de validation avant fusion

- Build Web et TypeScript verts.
- Lint vert.
- Tests unitaires/API existants verts.
- Playwright cycle métier complet vert.
- Playwright desktop/mobile navigation vert.
- Axe sans violation sérieuse/critique sur les écrans couverts.
- Aucun changement d’API ou de schéma introduit par ce lot.
- Aucune fusion si un contrôle requis échoue.
