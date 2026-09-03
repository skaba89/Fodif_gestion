# Étape 14b — Dossier de déploiement (environnement de test)

## Objectif et périmètre

Ce document décrit comment déployer un **environnement de test/démonstration** accessible sur
Internet, sur des services gratuits ou à faible coût, sans attendre le choix d'un hébergeur
institutionnel définitif (`docs/14-ROADMAP-SAAS-PREMIUM.md`, phase B7). Il n'est **pas** un plan
de mise en production :

- pas de séparation DEV/REC/PPD/PROD réelle (B7) ;
- pas de sauvegardes automatisées ni de plan de reprise complet (C6) — le mécanisme de sauvegarde
  et de restauration existe et est testé en continu (`docs/16-SAUVEGARDES-RESTAURATION.md`), mais
  rien ne le planifie encore automatiquement sur cet environnement de test (Neon/Supabase gèrent
  déjà leurs propres sauvegardes managées, indépendamment de ce mécanisme) ;
- pas de chiffrement au repos géré par un KMS dédié (B5) ;
- pas de revue de sécurité externe (B8).

À faire avant toute mise en production réelle. Pour un test/une démo interne, ce qui suit suffit.

## Vue d'ensemble

```text
Navigateur
    │
    ▼
Frontend Next.js (Render ou Netlify) ──API_BASE_URL──▶ API NestJS (Render, service Docker)
                                                              │
                                                              ├──▶ PostgreSQL géré (Neon ou Supabase)
                                                              └──▶ Stockage S3 compatible (Cloudflare R2,
                                                                    ou stockage S3 de Supabase)
```

L'API et le frontend sont chacun déployés depuis leur `Dockerfile` existant
(`apps/api/Dockerfile`, `apps/web/Dockerfile`) — aucune nouvelle configuration de build à
maintenir séparément du reste du dépôt.

## Prérequis

- Un compte [Render](https://render.com) (API, et frontend si vous ne préférez pas Netlify).
- Un compte [Netlify](https://netlify.com) (frontend, alternative à Render).
- Un compte [Neon](https://neon.tech) **ou** [Supabase](https://supabase.com) (PostgreSQL géré).
- Un compte [Cloudflare](https://cloudflare.com) pour R2 (stockage S3 compatible), ou activer le
  stockage S3 compatible de Supabase si vous utilisez déjà Supabase pour la base.
- Le dépôt poussé sur GitHub (déjà le cas).

## Étape 1 — Base de données PostgreSQL

**Neon** ou **Supabase** conviennent tous les deux : `DatabaseService` et
`scripts/run-migrations.js` détectent automatiquement qu'une connexion n'est pas locale et
activent TLS (`sslmode`) — aucune configuration TLS manuelle nécessaire.

1. Créez un projet, récupérez la chaîne de connexion (`postgresql://user:password@host/db`).
   - Neon : utilisez la chaîne de connexion « pooled » (PgBouncer) fournie par défaut.
   - Supabase : `Project Settings → Database → Connection string → URI`.
2. Gardez cette valeur de côté : ce sera `DATABASE_URL` à l'étape 3.

## Étape 2 — Stockage documentaire (S3 compatible)

`DocumentStorageService` ne nécessite qu'un point de terminaison compatible S3 — n'importe lequel
convient. Deux options simples :

- **Cloudflare R2** (recommandé, gratuit jusqu'à 10 Go) : créez un bucket, une clé d'API R2
  (accès S3), notez `Account ID`, `Access Key ID`, `Secret Access Key` et l'URL du point de
  terminaison S3 (`https://<account-id>.r2.cloudflarestorage.com`).
- **Supabase Storage** (si vous utilisez déjà Supabase) : activez le point de terminaison S3
  compatible dans `Project Settings → Storage → S3 Connection`.

## Étape 3 — Déployer l'API sur Render

1. Render → **New → Web Service** → connectez le dépôt GitHub.
2. Runtime : **Docker**. Dockerfile : `apps/api/Dockerfile`. Contexte de build : racine du dépôt
   (`.`) — important, car le Dockerfile copie `pnpm-lock.yaml` et `apps/web/package.json` depuis
   la racine du monorepo.
3. Health check path : `/api/v1/health`.
4. Variables d'environnement (Render → service → Environment) :

   | Variable | Valeur |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | la chaîne de connexion de l'étape 1 |
   | `JWT_SECRET` | **une vraie valeur aléatoire ≥ 32 caractères** — `openssl rand -base64 32` ; jamais la valeur de démonstration du dépôt |
   | `JWT_ISSUER` | `fodip-digital-2030` |
   | `JWT_AUDIENCE` | `fodip-web` |
   | `JWT_ACCESS_TTL` | `15m` |
   | `STORAGE_ENDPOINT` | point de terminaison S3 de l'étape 2 |
   | `STORAGE_REGION` | `auto` (R2) ou la région Supabase |
   | `STORAGE_BUCKET` | nom du bucket créé à l'étape 2 |
   | `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | clés de l'étape 2 |
   | `WEB_BASE_URL` | laissez un espace réservé pour l'instant (ex. `https://fodip-web.onrender.com`) ; à corriger à l'étape 6 une fois l'URL réelle du frontend connue — c'est l'origine autorisée par CORS |

   `PORT` n'a pas besoin d'être défini : Render l'injecte automatiquement et `main.ts` le lit déjà.

5. Déployez. Notez l'URL publique attribuée par Render (ex. `https://fodip-api.onrender.com`).

## Étape 4 — Appliquer les migrations

Une fois l'API déployée (même si elle échoue à démarrer faute de schéma, ce n'est pas grave à ce
stade), ouvrez l'onglet **Shell** du service Render et lancez :

```bash
node apps/api/scripts/run-migrations.js
```

Ajoutez `--seed` **uniquement** pour un environnement de démonstration dont le lien reste privé —
cela charge les comptes de démonstration documentés dans le `README.md`, avec un mot de passe
partagé connu de quiconque lit ce dépôt. Ne jamais `--seed` un environnement dont l'URL est
partagée publiquement ou durablement.

Depuis l'axe fondations entreprise (Lot 1), `run-migrations.js` refuse `--seed` d'emblée quand
`NODE_ENV=production` (le cas courant sur Render, qui le définit par défaut) - un garde-fou
volontairement strict pour la vraie production, quitte à devoir être explicitement contourné pour
la démo privée documentée ci-dessus :

```bash
NODE_ENV=development node apps/api/scripts/run-migrations.js --seed
```

Ne faites cela que dans l'onglet Shell d'un environnement de démonstration au lien privé, jamais
sur la base de données de production réelle.

## Étape 5 — Déployer le frontend

### Option A — Render (cohérent avec l'API, un seul tableau de bord)

Mêmes étapes qu'à l'étape 3 : **New → Web Service**, runtime **Docker**,
Dockerfile `apps/web/Dockerfile`, contexte `.`. Variables d'environnement :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `API_BASE_URL` | l'URL Render de l'API (étape 3) |
| `COOKIE_SECURE` | `true` — **obligatoire dès que le site est servi en HTTPS** (le cas sur Render/Netlify) ; à `false` le cookie de session n'est jamais envoyé par le navigateur et la connexion semble silencieusement échouer |

### Option B — Netlify

Netlify build son propre runtime Next.js (pas le `Dockerfile`) via son plugin Next.js, détecté
automatiquement dans la plupart des cas. Pour ce monorepo pnpm :

- **Base directory** : `apps/web`
- **Build command** : `pnpm install --frozen-lockfile && pnpm --filter @fodip/web build` (exécuté
  depuis la racine — ajustez si Netlify se place déjà dans `apps/web`)
- **Publish directory** : `apps/web/.next`
- Variables d'environnement : mêmes `API_BASE_URL` / `COOKIE_SECURE` que ci-dessus.

Un `netlify.toml` de départ est fourni à la racine — vérifiez-le contre la documentation Netlify
au moment du déploiement (le schéma évolue).

## Étape 6 — Reboucler les URLs

Une fois le frontend déployé et son URL connue, retournez sur le service **API** (Render) et
corrigez `WEB_BASE_URL` avec la vraie URL du frontend, puis redéployez l'API. Sans cette
correction, le frontend reçoit des réponses bloquées par CORS.

## Étape 7 — Vérification

1. `curl https://<api>/api/v1/health` → `{"status":"ok", ...}`.
2. Ouvrez le frontend, connectez-vous avec un compte créé via `run-migrations.js --seed`, ou créez
   un compte `SUPER_ADMIN` directement en base pour piloter l'environnement depuis
   `/administration/utilisateurs`.
3. Vérifiez qu'un dépôt de document (portail PME) fonctionne bout en bout — cela confirme que le
   stockage S3 compatible est correctement configuré.

## Sécurité — avant de partager le lien

- `JWT_SECRET` réellement aléatoire, jamais la valeur de démonstration.
- `COOKIE_SECURE=true` sur le frontend.
- Pas de `--seed` (comptes de démonstration à mot de passe connu) sur un lien partagé au-delà
  d'un test privé immédiat.
- Considérez cet environnement comme jetable : aucune donnée réelle de PME ou de dossier de
  financement ne doit y être saisie tant que B5/B7/B8 (`docs/14-ROADMAP-SAAS-PREMIUM.md`) ne sont
  pas traités.
