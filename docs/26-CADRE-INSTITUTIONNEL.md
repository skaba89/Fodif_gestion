# Étape 26 — Cadre de qualification institutionnelle

## Positionnement officiel

FODIP Digital 2030 est une **plateforme institutionnelle nationale en qualification**. Le cycle
métier principal est opérationnel, mais cette qualification ne constitue pas à elle seule une
autorisation de mise en production. L'ouverture à des données réelles et à des utilisateurs
externes exige un Go/No-Go formel fondé sur les portes décrites ci-dessous.

Le mode de démonstration reste un outil local distinct : données synthétiques, comptes dédiés et
bandeau visible. Il ne définit ni le niveau de maturité du produit, ni sa configuration de
production.

## États de maturité

| État | Définition | Autorisations |
|---|---|---|
| Développement | Construction et tests techniques | Données synthétiques uniquement |
| **Qualification institutionnelle** | **État actuel : parcours métier livré, preuves techniques disponibles, décisions d'exploitation en cours** | DEV/REC/PPD contrôlés |
| Homologué | Toutes les portes obligatoires sont validées et signées | Déploiement pilote autorisé |
| Production nationale | Pilote accepté, supervision et support opérationnels | Données réelles et utilisateurs nationaux |

Une communication ne doit jamais présenter l'état « qualification » comme « homologué » ou
« production nationale ».

## Portes obligatoires de mise en production

| Porte | Autorité de validation | Preuves attendues | État actuel |
|---|---|---|---|
| G1 — Gouvernance du code | DSI / responsable technique | PR obligatoire, branche protégée, CODEOWNERS, CI et CodeQL requis, journal des versions | **Partiel** — contrôles présents, protection GitHub à activer |
| G2 — Validation fonctionnelle | Direction FODIP / métiers | PV de recette des parcours PME, agent, comité, direction, banque et audit | **Partiel** — parcours automatisés, PV métier à signer |
| G3 — Intégrité financière | Direction financière / contrôle interne | Règles de rapprochement, écarts, devises, frais, maker-checker et délégations validés | **Partiel** — rapprochement exact livré, cas complexes à arbitrer |
| G4 — Sécurité et identité | RSSI / DSI | analyse de risques, pentest externe, SSO réel, MFA, KMS, gestion des vulnérabilités | **Partiel** — socle livré, KMS et pentest requis |
| G5 — Données et conformité | DPO / juridique | registre des traitements, durées de conservation, purge, droits des personnes, anonymisation non-prod | **Partiel** — export/effacement livrés, politique de rétention à valider |
| G6 — Hébergement et réseau | DSI / exploitation | choix d'hébergement, DEV/REC/PPD/PROD séparés, TLS, WAF, DNS, secrets, registre OCI | **Décision requise** |
| G7 — Continuité et exploitation | Exploitation / métiers | RPO/RTO, sauvegardes hors site, restauration, PRA/PCA, supervision, astreinte et support | **Partiel** — sauvegarde/restauration testée en CI |
| G8 — Qualité et accessibilité | QA / référent accessibilité | CI verte, non-régression, charge, navigateurs, mobile, lecteur d'écran réel, PV de recette | **Partiel** |
| G9 — Déploiement pilote | Sponsor / comité Go-No-Go | toutes les preuves précédentes, plan de retour arrière, support et périmètre pilote | **Non autorisé à ce stade** |

Une porte « Partiel », « Décision requise » ou « Non autorisé » interdit le passage en production
nationale. Une dérogation doit être écrite, limitée dans le temps, assortie d'un responsable et
d'un plan de traitement.

## Contrat des environnements

| Environnement | Données | Accès | Finalité |
|---|---|---|---|
| DEV | Synthétiques | Équipe technique | Développement |
| REC | Synthétiques ou production anonymisée/pseudonymisée | Recette métier nominative | Validation fonctionnelle |
| PPD | Représentatives et protégées | Équipe de qualification restreinte | Répétition de production |
| PROD | Réelles | Utilisateurs autorisés uniquement | Service institutionnel |

Règles non négociables :

- aucune donnée personnelle de production en DEV ou REC sans anonymisation/pseudonymisation
  validée ;
- aucune exécution des seeds `database/seeds/*` en PROD ;
- une même image OCI, identifiée par digest, est promue de PPD vers PROD ;
- les migrations sont additives, contrôlées par somme de contrôle et sauvegarde préalable ;
- tout secret provient du gestionnaire de secrets de l'environnement ;
- `DEMO_MODE` est absent ou faux en PPD et PROD.

## Gouvernance des changements

`main` représente uniquement un état intégrable. Les réglages GitHub attendus sont :

1. pull request obligatoire ;
2. branche à jour avant fusion ;
3. CI et CodeQL obligatoires ;
4. validation CODEOWNERS sur les zones sensibles ;
5. push direct, suppression et force-push interdits ;
6. conversations de revue résolues avant fusion.

Le dépôt fournit les contrôles et les propriétaires, mais l'activation de la protection relève des
paramètres GitHub du propriétaire du dépôt. Tant qu'elle n'est pas activée, G1 reste partiel.

## Dossier de preuve par version

Chaque version candidate à l'homologation doit conserver :

- le SHA Git et le digest des images OCI ;
- les résultats CI, CodeQL, Trivy, audit de dépendances et scan de secrets ;
- les SBOM CycloneDX et leurs signatures Sigstore ;
- le résultat des tests unitaires, d'intégration et Playwright ;
- la liste et la somme de contrôle des migrations ;
- les changements fonctionnels et de sécurité ;
- le plan de déploiement et de retour arrière ;
- les PV de recette et décisions Go/No-Go ;
- les risques résiduels et dérogations encore ouvertes.

La CI produit automatiquement un artefact `institutional-evidence-<run_id>` contenant un manifeste
JSON et un résumé Markdown : SHA, résultats des contrôles, liens d'exécution, inventaire signé par
SHA-256 des migrations et documents de gouvernance. Cet artefact ne remplace ni CodeQL, exécuté
séparément, ni les PV signés. Pour une version candidate, il doit être exporté avant l'expiration
de sa rétention GitHub et archivé avec les modèles de `docs/templates/` complétés.

## Décisions institutionnelles ouvertes

| Référence | Décision | Effet bloquant |
|---|---|---|
| DEC-001 | Hébergeur et région d'hébergement | G6, séparation des environnements |
| DEC-002 | Gestionnaire de secrets/KMS | G4 et G6, rotation des secrets dérivés |
| DEC-003 | RPO, RTO, sauvegarde hors site et PRA | G7 |
| DEC-004 | Durées de conservation par catégorie de données | G5, purge automatique |
| DEC-005 | Règles comptables pour écarts, frais, multi-devises et agrégats | G3 |
| DEC-006 | Périmètre organisationnel : FODIP seul ou multi-organisme | Modèle de données et exploitation |
| DEC-007 | Périmètre, prestataire et critères du pentest | G4 |

Chaque décision doit recevoir un propriétaire, une échéance, une décision datée et un lien vers
la preuve ou le procès-verbal correspondant.

Le suivi opérationnel se trouve dans `docs/28-REGISTRE-DECISIONS-HOMOLOGATION.md`.

## Prochaine cible

La prochaine cible officielle est **Homologation pilote**, pas l'ajout indifférencié de nouvelles
fonctionnalités. L'ordre recommandé est : sécuriser `main`, obtenir les décisions DEC-001 à
DEC-005, fermer les écarts de sécurité/exploitation, exécuter la recette institutionnelle, puis
soumettre le dossier complet au comité Go/No-Go.
