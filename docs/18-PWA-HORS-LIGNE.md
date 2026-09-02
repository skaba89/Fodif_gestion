# Étape 14e — PWA installable et repli hors ligne (axe D2)

## Objectif et périmètre

Axe **D2** de `docs/14-ROADMAP-SAAS-PREMIUM.md` : rendre l'application installable comme une
application (écran d'accueil mobile/desktop) et lui donner un repli correct quand le réseau
manque — le scénario visé étant un agent FODIP en zone à connectivité limitée. Contrairement à
B7b/B8, cet axe ne dépendait d'aucune décision d'hébergeur ou de prestataire externe : c'est un
mécanisme entièrement frontend (manifeste, icônes, service worker), construit et vérifié
directement dans ce dépôt.

## Le mécanisme

- **`apps/web/public/manifest.webmanifest`** — nom, icônes, couleur de thème/fond, `display:
  standalone`. Servi tel quel par Next (fichier statique sous `public/`) et lié depuis chaque page
  via l'API `metadata.manifest`/`metadata.icons` de `apps/web/app/layout.tsx`, plutôt que des
  balises `<link>` écrites à la main.
- **`apps/web/public/icons/`** — un monogramme « FD » généré par
  `scripts/generate-pwa-icons.py` (aucune dépendance image type Pillow/canvas dans ce dépôt ;
  script à usage unique, PNG assemblés directement via `struct`/`zlib`, à relancer seulement si la
  charte change). Quatre tailles : `icon-192`/`icon-512` (icônes standard), `apple-touch-icon`
  (180×180, iOS), et `icon-512-maskable` — même artwork mais réduit et recentré dans la zone de
  sécurité ~80 % que le manifeste W3C impose pour le pourpose `maskable` (l'OS peut recadrer
  l'icône en cercle/squircle et perdre tout ce qui dépasse cette zone).
- **`apps/web/public/sw.js`** — service worker écrit à la main (pas de Workbox : la stratégie
  tient dans une poignée de règles, lisibles en entier). Trois comportements distincts, jamais
  mélangés :
  - toute mutation (méthode non-GET) et toute requête vers `/api/*` (le proxy backend) traverse
    directement le réseau, jamais interceptée — une réponse API contient des données de session,
    parfois personnelles, qu'il ne faut jamais rejouer depuis un cache partagé, et un appel API
    hors ligne doit échouer normalement pour que l'interface affiche son propre état d'erreur ;
  - une navigation de page (`request.mode === 'navigate'`) est réseau d'abord — le repli vers la
    page `/hors-ligne` mise en cache à l'installation ne se déclenche que si `fetch()` échoue
    réellement ;
  - les fichiers statiques immuables de Next (`/_next/static/...`, hachés par contenu — un
    changement de code sort toujours sous une nouvelle URL) ainsi que les icônes et le manifeste
    sont cache d'abord, avec remplissage du cache au premier accès.
- **`apps/web/app/hors-ligne/`** — la page de repli elle-même : aucune donnée dynamique, aucun
  appel réseau au rendu (elle doit fonctionner avec strictement ce que le service worker a mis en
  cache), un bouton « Réessayer », et un rechargement automatique dès que l'événement `online` du
  navigateur se déclenche.
- **`apps/web/app/_shared/ServiceWorkerRegistration.tsx`** — enregistre `sw.js` une fois par
  session, monté dans `app/layout.tsx` donc actif depuis n'importe quel portail (PME, Agent,
  Comité, Direction, Administration, Auditeur, Partenaire).
- **`apps/web/next.config.ts`** — un unique `headers()` fixant `Cache-Control: no-cache` sur
  `/sw.js`, pour qu'une mise à jour poussée du service worker atteigne les visiteurs sans délai de
  cache intermédiaire. Vérifié que ce réglage est bien capturé dans `.next/routes-manifest.json` à
  la compilation : l'étage `runtime` du `Dockerfile` ne copie que `.next` (pas `next.config.ts`),
  et `next start` applique les en-têtes depuis ce manifeste, pas en ré-exécutant la configuration.

## Vérifié

- une vraie session Chromium (Playwright, sans Docker — même pipeline PostgreSQL/API/Web local
  que pour C3b/C4) a confirmé que le service worker s'enregistre, passe actif, prend le contrôle
  de la page, et met en cache exactement les quatre entrées du socle applicatif déclarées
  (`/hors-ligne`, `/manifest.webmanifest`, `/icons/icon-192.png`, `/icons/icon-512.png`) — ni plus,
  ni moins ;
- le document mis en cache pour `/hors-ligne` a été relu directement depuis l'API `Cache` du
  navigateur et contient bien le texte réel de la page (« Vous êtes hors ligne », bouton
  « Réessayer ») ;
- le manifeste et les quatre icônes sont servis avec un code 200 et le bon type de contenu ; le
  `<head>` de la page d'accueil contient les balises `<link rel="manifest">`/`<link rel="icon">`/
  `<link rel="apple-touch-icon">` attendues ;
- les 17 tests Playwright existants (accessibilité, connexion, MFA, workflow, chiffrement,
  Direction/Partenaire) passent toujours une fois le service worker actif sur chaque portail —
  aucune régression du chargement normal des pages ;
- **une limite honnête, trouvée en essayant plutôt que supposée** : simuler une vraie coupure
  réseau côté navigateur (`context.setOffline(true)`, puis en repli `context.route(...).abort()`)
  ne bloque ni l'une ni l'autre la requête que le service worker émet lui-même depuis son propre
  gestionnaire `fetch` — seules les requêtes émises directement par la page sont interceptées par
  ces mécanismes Playwright dans cet environnement. Une navigation "hors ligne" simulée ainsi
  revenait donc systématiquement avec du contenu bien réel, ce qui aurait masqué un service worker
  cassé aussi facilement qu'un service worker fonctionnel — un faux positif à ne pas garder. La
  suite `apps/web/e2e/pwa.spec.ts` vérifie donc ce qui est réellement démontrable dans cet
  environnement (enregistrement, contenu exact du cache, contenu réel de la page mise en
  cache) plutôt qu'un scénario de bout en bout qui ne peut pas être fiabilisé ici ; combiné à la
  lecture directe du code de `public/sw.js` (repli réseau-d'abord vers `caches.match(OFFLINE_URL)`
  uniquement si `fetch()` échoue), c'est le plafond honnête de ce qui est vérifiable dans ce bac à
  sable — un test manuel sur un vrai appareil (mode avion) reste la confirmation finale à faire une
  fois déployé.

## Un vrai bug que seule la CI a pu attraper

La CI de la PR initiale (`.github/workflows/ci.yml`, qui construit et lance les vraies images
Docker via `docker compose up`) a échoué sur les trois tests de `apps/web/e2e/pwa.spec.ts` -
`/sw.js` et `/manifest.webmanifest` répondaient 404 dans le conteneur réel. `apps/web/Dockerfile`
ne copiait jamais `apps/web/public/` dans l'étage `runtime` : contrairement à `.next/`, Next.js lit
`public/` directement sur le disque à chaque requête plutôt que de l'intégrer à la sortie de
compilation, donc son absence dans l'image ne casse rien à la construction - seulement au runtime,
et seulement dans le conteneur. Le pipeline de vérification locale sans Docker de ce dépôt (voir
plus haut) démarre toujours depuis l'arborescence source complète, `public/` déjà présent sur
disque : structurellement incapable de reproduire ce genre d'écart entre « ce qui existe dans le
dépôt » et « ce que l'étage `runtime` du Dockerfile copie réellement ». Corrigé par une ligne
`COPY` supplémentaire, reproduit directement (renommer temporairement `apps/web/public/`, lancer
`next start`, confirmer le 404, remettre en place, confirmer le 200) plutôt que supposé, et un
garde-fou ajouté à `scripts/check-docker.py` : si `apps/web/public/` contient des fichiers,
`apps/web/Dockerfile` doit contenir une ligne `COPY` les référençant, sous peine d'échouer la
vérification pré-push - pour que ce type de régression ne puisse plus se glisser silencieusement
une seconde fois.
