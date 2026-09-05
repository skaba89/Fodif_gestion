# Web — FODIP Digital 2030

Frontend Next.js + TypeScript, mobile-first.

## État actuel

L'interface institutionnelle couvre les portails entrepreneur, agent FODIP, comité, Direction, partenaire bancaire, auditeur et administration, avec navigation mobile, états de chargement/erreur et PWA.

Le cockpit Direction et les parcours métier consomment les API NestJS sécurisées. Les données synthétiques ne sont chargées que par les seeds locaux et restent signalées lorsque `DEMO_MODE=true`.

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

Le mode local peut afficher des données de démonstration, mais les calculs, contrôles d'accès et appels API sont ceux du produit réel. Aucun seed ni mot de passe de démonstration ne doit être utilisé dans un environnement institutionnel hébergé.

Aucun secret ni endpoint de production ne doit être ajouté au code ou commité dans Git.
