# 27 — Note au Directeur général : lancement de l'homologation pilote

## Objet de la décision

Autoriser le passage de **FODIP Digital 2030** du statut de plateforme institutionnelle en
qualification à un programme formel d'homologation, avec pour cible un pilote contrôlé avant toute
ouverture nationale.

La décision sollicitée ne porte pas sur une mise en production immédiate. Elle porte sur la
gouvernance, les responsables, les arbitrages et les moyens nécessaires pour produire les preuves
d'homologation décrites dans `docs/26-CADRE-INSTITUTIONNEL.md`.

## Situation actuelle

Le produit n'est plus un MVP. Le socle opérationnel couvre le cycle complet :

- dépôt et instruction des dossiers PME ;
- scoring explicable et décision humaine du comité ;
- financement, décaissement, échéancier, remboursement et suivi d'impact ;
- rapprochement des relevés bancaires avec traçabilité des anomalies ;
- cockpit national, indicateurs, alertes et audit des opérations ;
- portails séparés pour PME, agents, comité, Direction, administration, auditeurs et partenaires ;
- RBAC, MFA pour les rôles sensibles, support OIDC, chiffrement de données sensibles et contrôle
  d'intégrité documentaire ;
- CI, CodeQL, tests réels PostgreSQL/MinIO, tests multi-navigateurs, audit des dépendances, Trivy,
  SBOM CycloneDX signés et sauvegarde/restauration testée.

Ces acquis permettent une démonstration institutionnelle et une recette contrôlée. Ils ne
constituent pas encore une homologation de production.

## Blocages à lever

| Domaine | Décision ou preuve attendue | Responsable à désigner |
|---|---|---|
| Gouvernance | protection de `main`, revue obligatoire, propriétaires et journal des versions | DSI / responsable technique |
| Fonctionnel | PV de recette signé pour chaque rôle et parcours critique | Direction FODIP / métiers |
| Finance | règles sur écarts, frais, devises, délégations et contrôles croisés | Direction financière / contrôle interne |
| Sécurité | analyse de risques, vrai SSO, KMS, rotation des secrets et pentest externe | RSSI / DSI |
| Données | registre des traitements, conservation, purge, droits et anonymisation hors production | Juridique / DPO |
| Hébergement | région, fournisseur, DEV/REC/PPD/PROD, TLS, WAF, DNS, registre OCI et réseau | DSI / exploitation |
| Continuité | RPO/RTO, sauvegarde hors site, haute disponibilité et exercice PRA/PCA | Exploitation / métiers |
| Qualité | charge, accessibilité réelle, appareils représentatifs et non-régression | QA / référent accessibilité |
| Pilote | périmètre, utilisateurs, support, retour arrière et Go/No-Go | Sponsor / comité Go-No-Go |

## Arbitrages demandés à la Direction

1. Nommer le sponsor institutionnel et les membres du comité Go/No-Go.
2. Choisir le périmètre organisationnel : FODIP seul ou plateforme multi-organismes.
3. Valider les principes d'hébergement, de localisation et de souveraineté des données.
4. Mandater les responsables métier, finance, sécurité, juridique et exploitation.
5. Autoriser le budget d'infrastructure, de pentest, de qualification et d'accompagnement.
6. Définir le périmètre pilote : programme, région, agents, PME et partenaires bancaires.
7. Fixer une échéance pour la recette institutionnelle et la décision Go/No-Go.

Chaque arbitrage doit être daté, attribué à un propriétaire et relié à un procès-verbal ou à une
preuve conservée dans le dossier de version.

## Trajectoire proposée

### Phase 1 — Décisions et gouvernance

- protéger la branche principale et formaliser les responsabilités ;
- clôturer les décisions DEC-001 à DEC-007 du cadre institutionnel ;
- définir le périmètre, les critères et le calendrier du pilote.

### Phase 2 — Environnements et sécurité

- construire DEV, REC, PPD et PROD séparés ;
- intégrer le registre OCI, le gestionnaire de secrets/KMS, le vrai IdP et les protections réseau ;
- mettre en place supervision, alertes, sauvegardes hors site et procédures d'exploitation ;
- réaliser l'analyse de risques et le pentest, puis traiter les écarts bloquants.

### Phase 3 — Qualification

- exécuter la recette métier et financière avec données synthétiques ou protégées ;
- réaliser les tests de charge, d'accessibilité et de reprise après sinistre ;
- constituer le dossier de preuves signé pour la version candidate.

### Phase 4 — Pilote contrôlé

- former les utilisateurs et activer le support ;
- répéter le déploiement et le retour arrière en préproduction ;
- soumettre le dossier au comité Go/No-Go ;
- ouvrir le pilote uniquement après décision écrite, puis mesurer et clôturer ses écarts avant
  toute extension nationale.

## Recommandation

La Direction est invitée à autoriser **le lancement de l'homologation pilote**, et non la mise en
production nationale. La priorité doit porter sur les décisions, la sécurité, l'exploitation et
les preuves de recette ; toute nouvelle fonctionnalité non indispensable au pilote doit rester
secondaire jusqu'au Go/No-Go.

## Formulation proposée en séance

> FODIP Digital 2030 n'est plus un prototype. Son socle institutionnel couvre le cycle complet
> d'accompagnement et de financement des PME, avec sécurité, traçabilité et pilotage national. La
> prochaine étape est son homologation : nous demandons l'autorisation de mobiliser les métiers,
> la DSI, la finance, le juridique et la sécurité afin de préparer un pilote contrôlé, sans ouvrir
> de données réelles avant validation formelle du comité Go/No-Go.
