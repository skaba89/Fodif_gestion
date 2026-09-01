# Web — FODIP Digital 2030

Frontend Next.js + TypeScript, mobile-first.

## État actuel

Le socle UX/UI est initialisé avec un premier Cockpit Direction Générale responsive.

Espaces prévus : entrepreneur, agent FODIP, comité, Direction, partenaire, auditeur et observatoire.

## Lancer localement

Depuis la racine du monorepo :

```bash
pnpm install
pnpm --filter @fodip/web dev
```

Puis ouvrir `http://localhost:3000`.

## Build

```bash
pnpm --filter @fodip/web build
```

## Important

Les chiffres affichés dans le cockpit sont des données de démonstration. Ils seront remplacés par des données API après l'initialisation du backend.

Aucun secret ni endpoint de production ne doit être ajouté au code ou commité dans Git.
