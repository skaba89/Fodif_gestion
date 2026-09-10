# Routage de session multi-portails et connexion unique

## Objectif

FODIP Digital 2030 expose plusieurs espaces authentifiés : PME, Agent, Comité, Direction, Administration, Auditeur et Partenaire bancaire.

Tous les comptes utilisent désormais **un seul point d’entrée d’authentification : `/connexion`**. L’utilisateur ne choisit jamais son rôle dans le formulaire. Après authentification (et MFA lorsqu’il est requis), les rôles réellement retournés par l’API déterminent automatiquement l’espace autorisé.

Cette centralisation ne contourne pas le RBAC : le backend reste l’autorité pour l’identité, les rôles, les permissions et le périmètre des données.

## Registre canonique

Le fichier `apps/web/lib/portal-access.ts` est la source de vérité pour :

- la page de connexion commune `/connexion` ;
- la page d’accueil canonique de chaque rôle ;
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

La priorité existante de `resolveRoleHome()` reste utilisée lorsqu’un compte porte plusieurs rôles. Aucun rôle n’est fourni par le navigateur pour décider de l’autorisation.

## Compatibilité des anciennes URL

Les anciennes pages restent disponibles comme redirections de compatibilité vers `/connexion` :

- `/entrepreneur/connexion` ;
- `/agent/connexion` ;
- `/comite/connexion` ;
- `/direction/connexion` ;
- `/administration/connexion` ;
- `/auditeur/connexion` ;
- `/partenaire/connexion`.

Elles ne contiennent plus leur propre formulaire. Cela préserve les favoris et anciens liens sans maintenir sept implémentations de connexion.

## HTTP 401 — session expirée

Toute réponse `401` liée à une session expirée renvoie désormais vers :

`/connexion?reason=session-expired`

Le message d’expiration est affiché sur la page commune, quel que soit l’espace d’origine. Une déconnexion volontaire renvoie également vers `/connexion`, mais sans paramètre `reason` afin de rester distincte d’une expiration.

`AccountMenu` continue de mémoriser le dernier portail dans `sessionStorage` pour les contrôles de cohérence d’accès aux pages globales telles que `/notifications`, `/profil`, `/mes-donnees` et `/assistance`. Cette mémoire n’est jamais utilisée pour attribuer un rôle ou une permission.

La page `/assistance` reste consultable sans connexion et sans consommer de tentative d’authentification ; seul l’appel à l’assistant sécurisé passe par le client API partagé.

## HTTP 403 — session valide mais accès interdit

Un `403` ne signifie pas automatiquement que l’utilisateur se trouve dans le mauvais portail.

La règle reste :

1. lire la session courante via `/api/session/me` avec un `fetch` natif ;
2. si la session est devenue invalide, appliquer la règle `401` vers `/connexion` ;
3. si le rôle est autorisé dans le portail courant, conserver le `403` afin que la page traite la vraie insuffisance de permission ;
4. si le rôle n’est pas autorisé dans ce portail, rediriger vers son accueil canonique.

Cette logique évite les boucles de redirection et ne modifie aucune permission serveur.

## SSO institutionnel

Le bouton SSO est proposé sur `/connexion`, mais OIDC reste une **méthode d’authentification institutionnelle**, pas une méthode d’attribution de droits.

Le backend n’émet un jeton de livraison OIDC que pour un compte local actif possédant au moins un rôle institutionnel :

- `SUPER_ADMIN` ;
- `DIRECTION_FODIP` ;
- `ANALYSTE` ;
- `AGENT_FODIP` ;
- `COMITE_FINANCEMENT` ;
- `AUDITEUR`.

Un compte uniquement `PME` ou `PARTENAIRE_BANCAIRE` peut utiliser `/connexion` avec son mot de passe mais ne gagne pas l’accès au SSO institutionnel par cette centralisation.

Les anciennes valeurs techniques de portail OIDC restent reconnues uniquement pour permettre à un flux déjà engagé avant la mise à jour de se terminer ; leur callback revient lui aussi vers `/connexion`.

## Garde de portail

`AccountMenu` contrôle les rôles retournés par `/api/session/me` en plus de la simple validité de session.

Ainsi, un Partenaire bancaire qui tente d’ouvrir directement `/direction/tableau-de-bord` est ramené vers `/partenaire/financements`, tandis que l’API conserve son contrôle RBAC normal.

## Pages globales

Les pages suivantes utilisent le client API partagé et la résolution canonique des rôles lorsqu’elles accèdent à une ressource authentifiée :

- `/notifications` ;
- `/profil` ;
- `/mes-donnees` ;
- `/assistance`.

Le profil utilise les vrais codes RBAC (`DIRECTION_FODIP`, `ANALYSTE`, `COMITE_FINANCEMENT`) pour les libellés affichés.

## Non-régression

Ce lot :

- ne modifie aucun rôle ni aucune permission ;
- conserve JWT, MFA, révocation de session et le contrôle RBAC serveur ;
- ne modifie aucune règle financière ;
- ne crée aucune migration ;
- ne transforme jamais un `403` légitime en autorisation ;
- conserve le comportement de déconnexion volontaire distinct d’une expiration ;
- conserve l’accès public à la page d’assistance elle-même ;
- durcit OIDC pour éviter qu’un compte non institutionnel profite du SSO par effet de bord.

## Preuves automatisées

Les tests Playwright et unitaires vérifient notamment :

- la couverture du registre pour les huit codes de rôles RBAC ;
- le fait que les sept anciennes URL de connexion redirigent vers `/connexion` ;
- la redirection automatique d’un compte authentifié vers son espace canonique sans choix de rôle ;
- la déconnexion vers `/connexion` ;
- l’expiration vers `/connexion?reason=session-expired` ;
- le flux MFA depuis la page commune ;
- le logo FODIP et l’accessibilité WCAG de la page commune ;
- la conservation des frontières de rôle entre portails ;
- le retour OIDC vers la page de connexion unique.
