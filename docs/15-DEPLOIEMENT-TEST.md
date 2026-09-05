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
Frontend Next.js (Render) ──API_BASE_URL──▶ API NestJS (Render, service Docker)
                                                              │
                                                              ├──▶ PostgreSQL Neon (pooled)
                                                              └──▶ Neon Object Storage (S3)
```

L'API et le frontend sont chacun déployés depuis leur `Dockerfile` existant
(`apps/api/Dockerfile`, `apps/web/Dockerfile`) — aucune nouvelle configuration de build à
maintenir séparément du reste du dépôt.

## Prérequis

- Un compte [Render](https://render.com) pour l'API et le frontend.
- Un compte [Neon](https://neon.com) pour PostgreSQL et le stockage documentaire.
- Le dépôt poussé sur GitHub (déjà le cas).

Cette variante reste volontairement sur deux fournisseurs. Neon Object Storage est encore en
**bêta publique** et disponible uniquement en `us-east-2` au moment de la rédaction : elle convient
à la qualification avec données fictives, pas à l'hébergement institutionnel définitif.

## Étape 1 — Base de données PostgreSQL

1. Créez le projet Neon dans la région **AWS US East (Ohio) / `us-east-2`**. Cette région est
   obligatoire pour utiliser Neon Object Storage dans la même plateforme.
2. Dans **Connect**, récupérez les deux chaînes de connexion :
   - la chaîne **pooled** (hôte contenant `-pooler`) → `DATABASE_URL`, trafic normal de l'API ;
   - la chaîne **directe** (sans `-pooler`) → `DATABASE_URL_UNPOOLED`, migrations et amorçage.
3. Ne copiez jamais ces valeurs dans GitHub, un ticket ou un document partagé. Elles seront saisies
   uniquement comme secrets Render. `DATABASE_SSL=true` impose TLS des deux côtés.

## Étape 2 — Stockage documentaire (S3 compatible)

1. Activez **Object Storage** sur la branche Neon de test et créez le bucket privé
   `fodip-documents`.
2. Relevez les variables S3 de la branche et reportez-les dans Render selon ce mapping :

   | Neon | Render / FODIP |
   |---|---|
   | `AWS_ENDPOINT_URL_S3` | `STORAGE_ENDPOINT` |
   | `AWS_REGION` | `STORAGE_REGION` |
   | nom du bucket | `STORAGE_BUCKET` |
   | `AWS_ACCESS_KEY_ID` | `STORAGE_ACCESS_KEY` |
   | `AWS_SECRET_ACCESS_KEY` | `STORAGE_SECRET_KEY` |

Le bucket reste privé. Le backend utilise déjà l'adressage S3 « path-style » requis par Neon et ne
rend jamais les clés accessibles au navigateur.

## Étape 3 — Déployer l'API sur Render

1. Render → **New → Blueprint** → connectez `skaba89/Fodif_gestion` et sélectionnez `render.yaml`.
   Le Blueprint crée les deux services gratuits en région Ohio et ne déploie les nouveaux commits
   de `main` qu'après réussite des contrôles GitHub.
2. Renseignez les secrets demandés pour `fodip-api` :

   | Variable | Valeur |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | chaîne Neon pooled (`-pooler`) |
   | `DATABASE_URL_UNPOOLED` | chaîne Neon directe |
   | `JWT_SECRET` | généré automatiquement par Render |
   | `JWT_ISSUER` | `fodip-digital-2030` |
   | `JWT_AUDIENCE` | `fodip-web` |
   | `JWT_ACCESS_TTL` | `15m` |
   | `STORAGE_ENDPOINT` | `AWS_ENDPOINT_URL_S3` Neon |
   | `STORAGE_REGION` | `AWS_REGION` Neon (`us-east-2`) |
   | `STORAGE_BUCKET` | nom du bucket créé à l'étape 2 |
   | `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | clés S3 Neon |
   | `WEB_BASE_URL` | laissez un espace réservé pour l'instant (ex. `https://fodip-web.onrender.com`) ; à corriger à l'étape 6 une fois l'URL réelle du frontend connue — c'est l'origine autorisée par CORS |
   | `BOOTSTRAP_ADMIN_EMAIL` | adresse nominative de l'administrateur initial |
   | `BOOTSTRAP_ADMIN_NOM` / `BOOTSTRAP_ADMIN_PRENOM` | identité de l'administrateur initial |
   | `BOOTSTRAP_ADMIN_PASSWORD` | secret unique conforme à la politique (12+ caractères, majuscule, minuscule, chiffre, caractère spécial) |

   `PORT` n'a pas besoin d'être défini : Render l'injecte automatiquement et `main.ts` le lit déjà.

3. Déployez. Notez les deux URLs publiques attribuées par Render.

## Étape 4 — Migrations et premier administrateur

L'offre Render gratuite ne prend pas en charge la commande de pré-déploiement. Le `dockerCommand`
du Blueprint exécute donc, avant l'API :

1. les migrations versionnées, verrouillées et contrôlées par checksum via la connexion directe ;
2. l'amorçage idempotent du premier `SUPER_ADMIN`, avec mot de passe bcrypt et MFA obligatoire ;
3. le serveur NestJS uniquement si les deux étapes précédentes réussissent.

Dès le premier déploiement réussi, supprimez les quatre variables `BOOTSTRAP_ADMIN_*` dans Render
et redéployez. L'administrateur existant est conservé. Aucun seed ni mot de passe public du dépôt
n'est chargé sur cet environnement.

## Étape 5 — Déployer le frontend

Le Blueprint a déjà créé `fodip-web`. Renseignez ses variables :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `API_BASE_URL` | l'URL Render de l'API (étape 3) |
| `COOKIE_SECURE` | `true` — **obligatoire dès que le site est servi en HTTPS** (le cas sur Render/Netlify) ; à `false` le cookie de session n'est jamais envoyé par le navigateur et la connexion semble silencieusement échouer |
| `DEMO_MODE` | `true` — affiche explicitement « données de démonstration » |

## Étape 6 — Reboucler les URLs

Une fois le frontend déployé et son URL connue, retournez sur le service **API** (Render) et
corrigez `WEB_BASE_URL` avec la vraie URL du frontend, puis redéployez l'API. Sans cette
correction, le frontend reçoit des réponses bloquées par CORS.

## Étape 7 — Vérification

1. `curl https://<api>/api/v1/health/ready` → HTTP 200 avec PostgreSQL et S3 disponibles.
2. Ouvrez le frontend, connectez-vous avec le compte initial, puis terminez immédiatement
   l'enrôlement MFA.
3. Depuis `/administration/utilisateurs`, créez des comptes nominatifs de test pour les rôles
   Direction, Agent, Comité, PME, Banque et Auditeur ; n'utilisez pas de comptes partagés.
4. Vérifiez qu'un dépôt de document (portail PME) fonctionne bout en bout — cela confirme que le
   stockage S3 compatible est correctement configuré.

## Sécurité — avant de partager le lien

- `JWT_SECRET` réellement aléatoire, jamais la valeur de démonstration.
- `COOKIE_SECURE=true` sur le frontend.
- Variables `BOOTSTRAP_ADMIN_*` supprimées après l'amorçage et MFA activé.
- Aucun `--seed` ni compte partagé à mot de passe connu.
- Considérez cet environnement comme jetable : aucune donnée réelle de PME ou de dossier de
  financement ne doit y être saisie tant que B5/B7/B8 (`docs/14-ROADMAP-SAAS-PREMIUM.md`) ne sont
  pas traités.
