# Étape 4 — UX/UI FODIP Digital 2030

## Objectif

Créer une expérience institutionnelle premium, claire et mobile-first permettant à chaque profil d'accéder uniquement aux informations et actions utiles à son rôle.

## Principes de design

- Institutionnel, moderne et sobre.
- Priorité à la lisibilité des chiffres et des décisions.
- Mobile-first pour les entrepreneurs et agents terrain.
- Desktop optimisé pour la Direction, les analystes et les comités.
- Accessibilité : contraste, navigation clavier, structure sémantique et libellés explicites.
- Aucun indicateur important ne doit dépendre uniquement d'une couleur.
- Les opérations financières sensibles nécessiteront confirmation, traçabilité et permissions backend.

## Identité visuelle initiale

Palette fonctionnelle proposée :

- Vert institutionnel fort : `#084E32`
- Vert principal : `#0F6B45`
- Vert clair : `#DCEFE5`
- Or d'accent : `#D5A52B`
- Fond applicatif : `#F4F7F5`
- Texte principal : `#14231B`
- Texte secondaire : `#66756C`

La palette est volontairement paramétrable. Elle devra être validée ou adaptée lorsque la charte officielle FODIP sera disponible.

## Espaces utilisateurs

### 1. Direction générale

Écran d'entrée : cockpit national.

Contenu prioritaire :

- PME enregistrées ;
- dossiers en cours ;
- financements approuvés ;
- montants décaissés ;
- encours ;
- remboursement ;
- emplois créés ;
- répartition régionale ;
- répartition sectorielle ;
- performance par programme ;
- dossiers prêts pour comité ;
- alertes majeures.

### 2. Entrepreneur / PME

Parcours cible :

1. création du compte ;
2. création ou rattachement de la PME ;
3. diagnostic d'éligibilité ;
4. sélection d'un programme ;
5. dossier guidé en étapes ;
6. dépôt des documents ;
7. validation et soumission ;
8. suivi de l'instruction ;
9. réponse aux demandes de complément ;
10. suivi du financement et obligations post-financement.

Le tableau de bord PME doit prioriser : progression du dossier, actions requises, documents manquants, prochains jalons et messages FODIP.

### 3. Agent FODIP

Vue de travail orientée file d'attente :

- dossiers assignés ;
- dossiers sans responsable ;
- contrôles administratifs ;
- documents à vérifier ;
- délais d'instruction ;
- demandes de complément ;
- notes d'analyse ;
- historique complet.

### 4. Comité de financement

Vue décisionnelle concise :

- synthèse entreprise ;
- montant demandé ;
- analyse ;
- scoring et détail des critères ;
- risques identifiés ;
- documents essentiels ;
- recommandation analyste ;
- historique ;
- décision et conditions.

Le score est une aide à la décision et ne remplace jamais la décision humaine du comité.

### 5. Partenaire bancaire

Accès restreint selon conventions et scopes : dossiers transmis, décaissements, remboursements et échanges documentaires autorisés.

### 6. Auditeur

Interface principalement en lecture : décisions, historiques, mouvements financiers, journaux et exports contrôlés.

## Navigation Direction générale

- Vue nationale
- PME
- Dossiers
- Financements
- Décaissements
- Impact
- Programmes
- Partenaires
- Audit

## Cockpit Direction — socle institutionnel

Le produit contient un accueil institutionnel et un cockpit Direction connecté aux API :

- hero institutionnel ;
- indicateurs exécutifs consolidés ;
- analyses régionales, sectorielles et par programme ;
- pipeline d'instruction et points d'attention ;
- portefeuille financier, remboursements, impayés et impact ;
- navigation latérale responsive.

En local, les chiffres proviennent de données synthétiques clairement signalées ; dans les environnements homologués, ils proviennent du système transactionnel et des vues analytiques contrôlées.

## Évolutions UX restantes

Ordre recommandé pour la qualification :

1. composants partagés `Toast`, `Button`, `Dialog`, `FilterBar`, `Breadcrumbs` et `ResponsiveTable` ;
2. assistants guidés pour les parcours métier longs ;
3. références de régression visuelle produites sur le runner CI officiel ;
4. tests utilisateurs avec les profils institutionnels et PME ;
5. audit manuel avec lecteur d'écran réel ;
6. validation de la charte graphique officielle FODIP.

## Responsive

Trois comportements sont prévus :

- grand écran : navigation latérale complète ;
- tablette : navigation compacte ;
- smartphone : en-tête compact et contenus en une colonne.

## Données et sécurité

L'UI ne constitue jamais une barrière de sécurité. Toutes les permissions devront être appliquées côté API. Les informations sensibles ne devront pas être préchargées dans le navigateur si le rôle courant ne peut pas les consulter.
