# 23 — Présentation au Directeur général

> **Positionnement à employer : plateforme institutionnelle nationale en qualification.** La
> démonstration prouve le socle fonctionnel et technique ; elle ne vaut ni homologation, ni
> autorisation d'utiliser des données réelles. La note de décision à soumettre à la Direction est
> disponible dans `docs/27-NOTE-DIRECTEUR-HOMOLOGATION.md`.

Mission « Mettre FODIP Digital 2030 au niveau d'une présentation au Directeur général »
(branche `feat/dg-premium-presentation`). Ce document est le guide opérationnel de la
démonstration : comment démarrer, se connecter, dérouler le scénario en 10 minutes, et répondre
aux questions probables du DG — sans rien présenter comme réel qui ne le soit pas.

## 1. Objectif

Donner au Directeur général, en moins de 10 minutes, une vue claire de :
combien de PME sont accompagnées ; combien de dossiers reçus/en instruction/approuvés/rejetés ;
combien demandé/accordé/décaissé/remboursé ; l'encours ; les financements en retard ; les
régions/secteurs financés ; les emplois créés/maintenus ; les risques nécessitant une décision.

**Ce n'est pas un site de démonstration détaché** : chaque écran est le produit réel — RBAC et
MFA actifs, base PostgreSQL réelle, mêmes API que la production — chargé avec des données
fictives clairement annoncées comme telles.

## 2. Démarrer la démonstration

```bash
git clone https://github.com/skaba89/Fodif_gestion.git
cd Fodif_gestion
scripts/demo-presentation.sh -d      # -d : détaché ; retirer pour suivre les logs en direct
```

C'est un wrapper vérifié sur
`docker compose -f docker-compose.yml -f docker-compose.presentation.yml up --build` :
Postgres, MinIO, l'API et le web démarrent dans des conteneurs locaux, avec une seule différence
par rapport à `docker compose up` — la variable d'environnement `DEMO_MODE=true` sur le service
`web`, qui affiche le bandeau « Données de démonstration — aucune donnée réelle » sur chaque page
(`GET /api/config`, lu par `AppShell`). Aucun accès Azure, aucune donnée réelle : entièrement
local et reproductible.

> Le texte de mission cite `docker compose --profile presentation up --build` : Docker Compose ne
> permet pas à un profil de reconfigurer un service déjà toujours actif (`web` n'a pas de clé
> `profiles:`) sans dupliquer le service et entrer en conflit de port. Le script ci-dessus est la
> « configuration dédiée » que le texte de mission autorise explicitement comme alternative — testé
> et fonctionnel, contrairement à la commande littérale.

Une fois démarré (`docker compose ps` : tous les services `healthy`/`running`) :

- Application : http://localhost:3000
- API : http://localhost:4000/api/v1/health

Pour revenir à la démonstration standard sans le bandeau : `docker compose up --build`.

**Redémarrage propre** (entre deux démonstrations, pour repartir de données fraîches) :

```bash
docker compose down --volumes
scripts/demo-presentation.sh -d
```

`--volumes` supprime les données Postgres/MinIO du conteneur précédent ; les migrations et les
seeds (`database/`, `database/seeds/`) se rejouent automatiquement au démarrage suivant.

## 3. Connexion et MFA

Portail d'accueil : http://localhost:3000 — carte « Direction » → `/direction/connexion`.

| Compte | Email | Mot de passe |
|---|---|---|
| Direction | `direction@fodip.local` | `FodipDemo2026!` |
| Agent FODIP | `agent@fodip.local` | `FodipDemo2026!` |
| Comité de financement | `comite@fodip.local` | `FodipDemo2026!` |
| PME (Kankan Agro Transformation SARL) | `pme@fodip.local` | `FodipDemo2026!` |
| Administration | `admin@fodip.local` | `FodipDemo2026!` |
| Auditeur | `auditeur@fodip.local` | `FodipDemo2026!` |
| Partenaire bancaire | `partenaire@fodip.local` | `FodipDemo2026!` |

Le compte `direction@fodip.local` n'exige pas de code MFA (`mfa_required: false` dans les données
de démonstration) — un choix délibéré pour que la démonstration reste fluide sans dépendre d'une
application d'authentification sur le poste de présentation. **Le MFA lui-même est bien réel et
actif sur la plateforme** : tout compte à rôle privilégié (`SUPER_ADMIN`, `DIRECTION_FODIP`,
`AGENT_FODIP`, `ANALYSTE`, `COMITE_FINANCEMENT`, `AUDITEUR`) créé ou promu depuis
`/administration/utilisateurs` est automatiquement soumis à l'enrôlement TOTP dès sa première
connexion — impossible à désactiver par une simple option, appliqué côté serveur
(`apps/api/src/admin-policy.js`). `apps/web/e2e/executive-demo.spec.ts` le prouve en conditions
réelles : il crée un compte Direction temporaire, complète l'enrôlement (QR/secret affiché,
code à 6 chiffres saisi) puis la vérification au second login, avant de le désactiver.

Pour montrer le MFA en direct pendant la démonstration : créer un compte depuis
`/administration/utilisateurs` avec le rôle « Direction FODIP » (ou tout rôle privilégié) et se
connecter avec — l'écran d'enrôlement (secret + QR) apparaît immédiatement.

## 4. Scénario de démonstration (10 minutes)

Parcours stable, entièrement automatisé et vérifié par `apps/web/e2e/executive-demo.spec.ts` :

1. **Accueil institutionnel** (`/`) — présentation de la plateforme, sélection du portail.
2. **Connexion Direction** (`/direction/connexion`).
3. **MFA** — voir §3 pour la démontrer en direct avec un compte à rôle privilégié.
4. **Cockpit national** (`/direction/tableau-de-bord`) — KPI exécutifs, points d'attention.
5. **Filtre région** — sélectionner une région, observer KPI/graphiques/tableaux se mettre à jour.
6. **Dossier PME** — depuis le portail Agent, « Vue 360° » d'un dossier.
7. **Décision comité** — depuis le portail Comité, décision motivée sur un dossier prêt.
8. **Financement** — depuis `/direction/financements`, création d'un financement à partir d'une
   décision approuvée.
9. **Décaissements** — planification puis confirmation d'une tranche.
10. **Remboursements** — enregistrement d'un paiement sur une échéance.
11. **Suivi d'impact** — enregistrement d'un relevé d'impact (emplois, chiffre d'affaires).

> Le texte de mission (section 10) évoque « 13 étapes » sans jamais en nommer plus de 11 (section
> 8, reproduites ci-dessus). Seules ces 11 étapes réelles sont implémentées et testées — aucune
> étape n'a été ajoutée artificiellement pour atteindre ce chiffre.

Chaque étape correspond à une action réellement cliquée et vérifiée par le test, pas à une
capture d'écran statique : dépôt du dossier, prise en charge et notation par l'agent, décision du
comité, création du financement, décaissement, remboursement et relevé d'impact sont tous des
écritures réelles en base, visibles immédiatement dans le cockpit national.

## 5. Messages clés pour le DG

- **Un référentiel unique** : un seul dossier, suivi de bout en bout — dépôt, instruction,
  décision, financement, décaissement, remboursement, impact — visible par tous les acteurs
  habilités, sans ressaisie.
- **Pilotage en temps réel** : chaque KPI du cockpit (PME accompagnées, dossiers par statut,
  montants demandé/accordé/décaissé/remboursé, encours, impayés, taux de remboursement, emplois,
  parité femmes/jeunes) est calculé à la demande depuis les données réelles du périmètre filtré —
  aucune valeur codée en dur.
- **Alertes actionnables** : la section « Points d'attention » signale les échéances en retard,
  les décaissements non exécutés, les dossiers bloqués au-delà du SLA d'instruction, les données
  d'impact non actualisées et la concentration excessive sur une région ou un programme — avec
  sévérité, montant, nombre de dossiers et action recommandée.
- **Sécurité non négociable** : RBAC par rôle et MFA obligatoire sur tout compte à privilège
  restent actifs, y compris en mode démonstration.
- **Accessible partout** : navigation mobile corrigée (menu, tiroir accessible) — le cockpit se
  consulte aussi depuis une tablette ou un smartphone, pas seulement au bureau.

## 6. Écrans à montrer

| Écran | Route | Ce qu'il démontre |
|---|---|---|
| Accueil institutionnel | `/` | Sélecteur de portails, image de marque |
| Cockpit national | `/direction/tableau-de-bord` | KPI exécutifs, filtres, alertes, graphiques |
| Financements | `/direction/financements` | Liste, création depuis une décision approuvée |
| Détail d'un financement | `/direction/financements/[id]` | Décaissements, échéancier, impact |
| Vue 360° d'un dossier | `/agent/dossiers/[id]` | Instruction, scoring, historique |
| Décision comité | `/comite/dossiers/[id]` | Décision motivée, traçabilité |
| Design system | `/design-system` | Composants, cohérence visuelle inter-portails |

## 7. Questions probables du DG — réponses

**« Ces chiffres sont-ils réels ? »**
Non, en mode démonstration — le bandeau « Données de démonstration » l'indique sur chaque page
tant que `DEMO_MODE=true`. Le calcul, lui, est réel : mêmes requêtes, même API que celles qui
s'exécuteraient sur des données de production.

**« Que se passe-t-il si une donnée manque ? »**
Le cockpit affiche explicitement « Donnée indisponible » plutôt qu'une valeur fictive — par
exemple le taux de dirigeantes femmes ou de dirigeants jeunes, calculé uniquement quand
l'information est réellement renseignée sur le périmètre filtré.

**« Le système est-il sécurisé ? »**
RBAC (permissions par rôle, contrôlées côté serveur) et MFA obligatoire sur les rôles privilégiés
sont actifs à tout moment, y compris en démonstration — voir §3.

**« Peut-on l'utiliser depuis un téléphone ou une tablette ? »**
Oui — la navigation mobile (menu, tiroir accessible, cibles tactiles ≥44×44px) fonctionne dès
360px de large, vérifiée par les projets Playwright Pixel 7 et iPhone 14
(`apps/web/playwright.config.ts`).

**« Quand est-ce disponible en production ? »**
Le socle est en qualification institutionnelle. Le rapprochement bancaire, l'idempotence des
écritures sensibles, le maker-checker sur les décaissements et le scan antivirus sont livrés ou
partiellement couverts, mais une production nationale exige encore les validations formelles du
cadre d'homologation : hébergement, sécurité externe, conformité, exploitation, recette métier et
Go/No-Go. Voir `docs/26-CADRE-INSTITUTIONNEL.md` et §9.

## 8. Limites actuelles — honnêtement déclarées

- **Alertes « documents manquants »** : sur les 7 types d'alerte cités par la mission, 6 sont
  calculés à partir de données réelles (échéances en retard, financements non décaissés, dossiers
  bloqués au-delà du SLA, impact non actualisé, concentration excessive région/programme, banques
  partenaires en retard). Le type « documents manquants » n'est pas implémenté : le schéma actuel
  n'a pas de configuration de checklist documentaire par programme à partir de laquelle le
  calculer sans l'inventer.
- **Composants partagés restants** : `AppShell`, `AccountMenu`, `Drawer`, `KpiCard`,
  `ExecutiveAlert`, `ConfirmDialog`, `Skeleton`, `EmptyState`, `ErrorState` sont mutualisés et en
  service. `Toast`, `Button`, `Dialog` générique, `FilterBar` autonome, `Breadcrumbs` et
  `ResponsiveTable` (tableaux en cartes sur mobile) restent à construire comme composants
  dédiés — un correctif d'accessibilité minimal (`tabIndex`/`role="region"`/`aria-label` sur les
  conteneurs de défilement horizontal) est en place en attendant, vérifié sans violation WCAG
  sérieuse sur mobile.
- **Redirection 403** : `apps/web/lib/client-api.ts` redirige automatiquement vers la connexion
  sur une réponse 401, pas encore sur une réponse 403 (rôle authentifié mais insuffisant) — un
  utilisateur au mauvais rôle reste sur la page avec l'erreur API, sans parcours de réorientation
  dédié. Il s'agit d'un écart d'expérience utilisateur, pas d'un contournement du contrôle RBAC
  côté serveur.
- **Couverture navigateur mobile** : les projets Playwright « Pixel 7 » (Chromium) et « iPhone
  14 » (WebKit) font partie de la matrice CI, avec Chromium, Firefox et WebKit desktop. Cette
  émulation apporte une preuve de non-régression automatisée ; elle ne remplace pas une recette
  d'accessibilité sur appareils et technologies d'assistance réels.
- **Captures de référence pour la régression visuelle** : non ajoutées dans cette itération —
  des captures figées dans cet environnement de développement ne correspondraient pas au rendu de
  polices/anticrénelage du runner CI et casseraient à la première exécution CI plutôt que
  d'apporter une protection réelle. À établir directement depuis le runner CI cible.

## 9. Feuille de route — avant une bascule nationale

Cette plateforme **n'est pas déclarée prête pour une exploitation nationale** tant que les points
suivants ne sont pas finalisés :

- Haute disponibilité (réplication Postgres, plusieurs instances API/web, bascule automatique).
- Idempotence financière de bout en bout sur les décaissements et remboursements — **partiellement
  fait** : clé d'idempotence (`Idempotency-Key`) sur les 4 écritures à risque de doublon réel
  (décaissement/remboursement, Direction et Partenaire), avec claim atomique en base et rejeu de la
  réponse déjà produite sur une même clé (voir `docs/14-ROADMAP-SAAS-PREMIUM.md`, axe E5).
- Contrôle maker-checker sur les opérations financières sensibles — **partiellement fait** : la
  personne qui exécute un décaissement (confirmation bancaire, l'argent sort réellement) ne peut
  plus être celle qui l'a planifié, imposé à la fois par l'application (rejet explicite) et par une
  contrainte PostgreSQL (`ck_decaissements_maker_checker`) — voir `docs/14-ROADMAP-SAAS-PREMIUM.md`,
  axe E5. Le remboursement n'a pas de flux à deux étapes équivalent (enregistrement direct d'un
  paiement déjà reçu) : le maker-checker ne s'y applique pas de la même façon et reste à évaluer.
- Antivirus/scan de contenu sur les documents déposés — **partiellement fait** : les documents sont
  désormais scannés en clamd (`ClamAvService`) avant d'être persistés, en échec fermé (un scan
  indisponible refuse l'upload plutôt que de le laisser passer), désactivé par défaut comme l'OIDC
  (voir `docs/14-ROADMAP-SAAS-PREMIUM.md`, axe E6). Le versioning est livré ; restent la
  quarantaine et l'upload en streaming (le fichier est encore bufferisé en mémoire à l'upload).
- Plan de reprise d'activité (PRA) documenté et testé au-delà de la sauvegarde/restauration
  Postgres déjà couverte par `scripts/backup-postgres.sh`/`scripts/test-backup-restore.sh`.

## 10. Plan de secours sans connexion Internet

La démonstration est conçue pour fonctionner **entièrement hors ligne** une fois les images
Docker construites :

1. Construire les images à l'avance, avec accès Internet : `docker compose build`.
2. Vérifier que le cache pnpm/Docker est local (`docker images` liste `fodip-digital-api` et
   `fodip-digital-web`).
3. Le jour de la présentation, sans réseau : `scripts/demo-presentation.sh -d` réutilise les
   images déjà construites — aucun accès réseau requis (Postgres, MinIO, l'API et le web sont
   tous des conteneurs locaux).
4. En cas d'incident pendant la présentation : `docker compose down --volumes` puis relancer
   `scripts/demo-presentation.sh -d` restaure un état propre en moins d'une minute, sans
   dépendance externe.
