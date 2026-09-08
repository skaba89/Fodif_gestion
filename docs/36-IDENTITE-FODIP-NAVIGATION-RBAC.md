# Identité FODIP, navigation multi-portails et isolation RBAC

## Statut

Ce document décrit le lot d'harmonisation de l'identité visuelle et du parcours d'authentification de FODIP Digital 2030.

La plateforme reste une **plateforme institutionnelle nationale en qualification**. Ce lot ne modifie aucune habilitation backend, aucun rôle et aucune permission.

## 1. Identité visuelle

### Logo

Le produit utilise l'actif logo actuellement publié par l'écosystème web institutionnel FODIP :

`https://fodipgn.com/images/logo/1719846542.jpg`

Le logo n'est ni redessiné ni généré par la plateforme. Le composant partagé `FodipOfficialBrand` centralise son utilisation sur :

- l'accueil de sélection des espaces ;
- les écrans de connexion ;
- le shell authentifié ;
- le menu latéral ;
- le profil ;
- les notifications ;
- la page Mes données ;
- l'assistance.

L'image est chargée avec `referrerPolicy="no-referrer"`, `loading="lazy"` et `decoding="async"`. La marque textuelle FODIP reste présente si l'actif distant ne peut pas être chargé.

### Couleurs

Le logo FODIP actuellement publié est construit autour de deux verts : un vert foncé dominant et un vert clair secondaire.

Aucune charte FODIP publique comportant des valeurs hexadécimales normatives n'a été identifiée au moment de ce lot. Les tokens de l'interface sont donc **alignés visuellement sur l'actif officiel**, puis ajustés pour respecter les contrastes WCAG AA. Ils ne doivent pas être présentés comme une charte juridique de marque.

Tokens de référence du produit :

- `--fodip-green-dark: #174b0b` ;
- `--fodip-green-light: #62a449`.

Si le FODIP fournit ultérieurement un fichier de charte officiel (AI/SVG/PDF/PNG et références RGB/CMJN/Pantone), ces deux tokens devront être remplacés par les valeurs validées sans modifier les composants métier.

## 2. Principe de connexion

L'API reste l'autorité pour :

- l'authentification ;
- le MFA/TOTP ;
- l'OIDC/SSO ;
- les rôles ;
- les permissions ;
- le périmètre de données.

Le frontend ne transforme jamais une réponse `403` en autorisation.

### Mauvais portail

Lorsqu'un compte valide utilise un écran de connexion qui ne correspond pas à son rôle :

1. l'authentification du compte peut réussir ;
2. le frontend lit les rôles retournés par la session ;
3. il ne monte pas le contenu du portail non autorisé ;
4. il redirige le compte vers son espace canonique.

Exemples :

- `AGENT_FODIP` -> `/agent/dossiers` ;
- `COMITE_FINANCEMENT` -> `/comite/dossiers` ;
- `DIRECTION_FODIP` / `ANALYSTE` -> `/direction/tableau-de-bord` ;
- `SUPER_ADMIN` -> `/administration/utilisateurs` ;
- `AUDITEUR` -> `/auditeur/tableau-de-bord` ;
- `PARTENAIRE_BANCAIRE` -> `/partenaire/financements` ;
- `PME` -> `/entrepreneur`.

`SUPER_ADMIN` conserve les portails explicitement autorisés par le registre RBAC existant. Ce lot ne réduit ni n'étend ces droits.

## 3. Changement d'utilisateur

Un écran de connexion ne remplace plus silencieusement une session déjà active.

Si une session FODIP existe, l'utilisateur voit deux choix :

- **Continuer vers mon espace** : navigation vers l'accueil canonique du compte actif ;
- **Changer d'utilisateur** : `POST /api/session/logout`, puis seulement après fermeture réussie de la session, réaffichage du formulaire de connexion.

Ce comportement évite qu'une personne pense utiliser un second compte alors que le navigateur conserve encore le premier.

## 4. Navigation

Le shell partagé :

- conserve le menu du portail courant ;
- maintient l'entrée parent active sur les sous-pages, par exemple `/agent/dossiers/:id` sous `Dossiers` ;
- propose `Mon espace`, `Assistance`, `Mon profil`, `Déconnexion` ;
- ne montre ni email ni rôle dans le chrome global ;
- redirige une session valide ouverte sur le mauvais portail vers son espace canonique ;
- redirige une session expirée vers l'écran de connexion du même portail.

Les pages globales `profil`, `notifications`, `mes-donnees` et l'assistance authentifiée reviennent vers l'espace calculé à partir du rôle de la session, et non vers un portail codé en dur.

## 5. Isolation des données

Ce lot n'essaie pas de sécuriser les données uniquement par l'interface.

Les contrôles backend existants restent obligatoires. Par exemple, les données PME sont recherchées selon l'entreprise détenue par la session et les endpoints métier restent protégés par rôles/permissions. Un utilisateur qui forge manuellement une URL ou une requête ne doit pas obtenir de données parce que le frontend l'a cachée : c'est l'API qui doit refuser l'accès.

## 6. Tests de non-régression

Les tests Playwright couvrent notamment :

- registre canonique rôle -> portail ;
- compte valide utilisé depuis le mauvais portail -> redirection vers son propre espace ;
- session déjà active -> choix explicite continuer/changer d'utilisateur ;
- fermeture de session avant changement de compte ;
- profil personnel affiché uniquement sur la page profil ;
- navigation par hamburger ;
- retour vers l'espace canonique ;
- expiration de session vers le login du même rôle ;
- mauvais mot de passe sans création de session ;
- source de l'actif logo FODIP ;
- présence des deux tokens verts de l'identité produit.

## 7. Point à finaliser pour une production homologuée

Pour supprimer toute dépendance à un domaine public externe, le FODIP devra fournir ou approuver une copie officielle du logo à embarquer dans `apps/web/public/brand/`. Cette copie devra être traçable (source, date d'approbation, checksum) et remplacera alors l'URL distante sans changement fonctionnel.
