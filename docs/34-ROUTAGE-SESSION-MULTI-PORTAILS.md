# Routage de session multi-portails

## Objectif

FODIP Digital 2030 expose plusieurs espaces authentifiés : PME, Agent, Comité, Direction, Administration, Auditeur et Partenaire bancaire.

Le traitement des erreurs de session ne doit jamais envoyer tous les utilisateurs vers le portail PME. Le routage doit rester cohérent avec le rôle réellement présent dans la session, sans contourner le RBAC de l'API.

## Registre canonique

Le fichier `apps/web/lib/portal-access.ts` est désormais la source de vérité pour :

- la page de connexion de chaque portail ;
- la page d'accueil canonique de chaque rôle ;
- les rôles autorisés dans chaque portail.

Correspondances principales :

| Rôle | Accueil canonique |
|---|---|
| `SUPER_ADMIN` | `/administration/utilisateurs` |
| `DIRECTION_FODIP` | `/direction/tableau-de-bord` |
| `ANALYSTE` | `/direction/tableau-de-bord` |
| `AGENT_FODIP` | `/agent/dossiers` |
| `COMITE_FINANCEMENT` | `/comite/dossiers` |
| `AUDITEUR` | `/auditeur/tableau-de-bord` |
| `PARTENAIRE_BANCAIRE` | `/partenaire/financements` |
| `PME` | `/entrepreneur` |

## HTTP 401 — session expirée

Sur une page située dans un portail, une réponse `401` renvoie vers la page de connexion de ce portail avec :

`?reason=session-expired`

Exemples :

- Direction → `/direction/connexion?reason=session-expired` ;
- Agent → `/agent/connexion?reason=session-expired` ;
- Partenaire → `/partenaire/connexion?reason=session-expired`.

`AccountMenu` mémorise également le dernier portail dans `sessionStorage`. Cette information permet aux pages globales telles que `/notifications`, `/profil`, `/mes-donnees` et `/assistance` de conserver le bon contexte de connexion après expiration de la session lorsqu'elles appellent une API authentifiée.

La page `/assistance` reste consultable sans connexion et sans consommer de tentative d'authentification ; seul l'appel à l'assistant sécurisé passe par le client API partagé.

Si aucun contexte de portail fiable n'existe, la plateforme revient à la page d'accueil publique au lieu de supposer un rôle.

## HTTP 403 — session valide mais accès interdit

Un `403` ne signifie pas automatiquement que l'utilisateur se trouve dans le mauvais portail.

La règle est donc :

1. lire la session courante via `/api/session/me` avec un `fetch` natif ;
2. si la session est devenue invalide, appliquer la règle `401` ;
3. si le rôle est autorisé dans le portail courant, conserver le `403` afin que la page traite la vraie insuffisance de permission ;
4. si le rôle n'est pas autorisé dans ce portail, rediriger vers son accueil canonique.

Cette logique évite les boucles de redirection et ne modifie aucune permission serveur.

## Garde de portail

`AccountMenu` contrôle désormais les rôles retournés par `/api/session/me` en plus de la simple validité de session.

Ainsi, un Partenaire bancaire qui tente d'ouvrir directement `/direction/tableau-de-bord` est ramené vers `/partenaire/financements`, tandis que l'API conserve son contrôle RBAC normal.

## Pages globales

Les pages suivantes utilisent le client API partagé et la résolution canonique des rôles lorsqu'elles accèdent à une ressource authentifiée :

- `/notifications` ;
- `/profil` ;
- `/mes-donnees` ;
- `/assistance`.

Le profil utilise également les vrais codes RBAC (`DIRECTION_FODIP`, `ANALYSTE`, `COMITE_FINANCEMENT`) pour les libellés affichés.

## Non-régression

Ce lot :

- ne modifie aucun rôle ni aucune permission ;
- ne modifie ni JWT, MFA, OIDC ni révocation de session ;
- ne change aucune route backend ;
- ne crée aucune migration ;
- ne transforme jamais un `403` légitime en autorisation ;
- conserve le comportement de déconnexion volontaire distinct d'une expiration ;
- conserve l'accès public à la page d'assistance elle-même.

## Preuves automatisées

Les tests Playwright vérifient :

- la couverture du registre pour les huit codes de rôles RBAC ;
- les sept pages de connexion canoniques ;
- l'expiration d'une session Direction depuis la page globale `/notifications` ;
- la réorientation d'un Partenaire bancaire depuis un portail Direction non autorisé ;
- l'accessibilité publique de `/assistance` sans tentative de connexion ;
- les comportements de connexion, profil, logout et expiration déjà existants.
