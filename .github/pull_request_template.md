<!--
Une PR = un objectif. Si cette liste ne rentre pas dans une seule phrase claire, la PR est
probablement trop large - voir la méthode de travail par lots (docs/14-ROADMAP-SAAS-PREMIUM.md).
-->

## Contexte

<!-- Quel axe/lot ? Quel problème ou quel besoin ? Lien vers la roadmap ou l'issue si pertinent. -->

## Contenu

<!-- Fichiers/modules touchés et pourquoi. Migration ajoutée ? Backward-compatible ? -->

## Risques

<!-- Ce qui pourrait casser, et pourquoi ce n'est pas le cas (ou comment c'est mitigé). "Aucun
risque identifié" est une réponse valide si c'est vraiment le cas - jamais une case cochée sans
y avoir réfléchi. -->

## Validation locale

<!-- Commandes exécutées et leur résultat réel (pas "les tests passent" sans détail). Exemple :
- `pnpm lint` : OK
- `pnpm --filter @fodip/api test` : NN/NN tests
- `pnpm --filter @fodip/api build` / `pnpm --filter @fodip/web build` : OK
- `docker compose config --quiet` : OK
- `pnpm --filter @fodip/web test:e2e` : NN/NN tests (si applicable)
- Docker : décrire ce qui a pu être vérifié réellement, et ce qui n'a pas pu l'être si Docker
  Desktop/un daemon Docker n'était pas disponible - jamais supposé fonctionner sans l'avoir vu. -->

## Captures desktop / mobile

<!-- Obligatoire pour tout changement d'interface utilisateur. Sinon, supprimer cette section. -->

## Statut

<!-- Un des suivants, honnêtement : FAIT / PARTIEL / NON FAIT / BLOQUÉ / DÉCISION REQUISE.
Si PARTIEL ou BLOQUÉ, préciser ce qui manque et pourquoi. -->
