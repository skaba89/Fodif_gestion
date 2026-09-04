-- Sprint Enterprise 0, axe E5 (intégrité financière, docs/14-ROADMAP-SAAS-PREMIUM.md) - table
-- support pour les clés d'idempotence sur les écritures financières les plus exposées à une
-- double soumission (planification de décaissement, enregistrement de remboursement, côté
-- Direction comme côté partenaire bancaire). Additive : aucune table existante modifiée.
--
-- Modèle : le client envoie un en-tête `Idempotency-Key` (généré une fois par intention de
-- soumission, réutilisé si la même requête est renvoyée après un échec réseau). Le serveur
-- (IdempotencyService, apps/api/src/common/idempotency.service.ts) réclame la clé via un INSERT
-- avec contrainte d'unicité (scope, cle) : le premier appelant à insérer exécute réellement
-- l'opération, tout appelant suivant avec la même clé reçoit la réponse déjà produite (rejouée)
-- plutôt que de ré-exécuter l'écriture - empêche un double décaissement/remboursement causé par un
-- double clic ou une relecture réseau, sans bloquer une véritable nouvelle soumission (nouvelle
-- clé). `empreinte_requete` détecte la réutilisation d'une même clé pour une charge utile
-- différente (409, jamais une exécution silencieuse de l'une ou l'autre requête).
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope VARCHAR(100) NOT NULL,
    cle VARCHAR(200) NOT NULL,
    utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id),
    empreinte_requete VARCHAR(64) NOT NULL,
    statut_reponse INTEGER,
    corps_reponse JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_idempotency_scope_cle UNIQUE (scope, cle)
);

-- Sert scripts/purge-idempotency-keys.js (E5, à livrer séparément - une clé n'a besoin de vivre
-- que le temps où un client pourrait réellement relire une soumission, pas indéfiniment).
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys(created_at);

-- Sprint Enterprise 0, axe E5 (suite) - contraintes CHECK sur les statuts des écritures
-- financières, jusqu'ici uniquement validés côté application (DTO/service), jamais au niveau
-- base : un bug applicatif ou une requête SQL manuelle erronée pouvait jusqu'ici écrire un statut
-- invalide sans qu'aucune couche ne s'y oppose. Valeurs listées à partir de l'usage réel du code
-- ET des données déjà commitées (grep sur chaque colonne `statut`, y compris database/seeds/) -
-- additif, aucune ligne existante n'est concernée puisque rien n'a jamais écrit de valeur hors de
-- ces listes. `financements.statut` n'a délibérément PAS de contrainte équivalente ici : tout le
-- code et toutes les données de ce dépôt n'écrivent jamais que 'ACTIF' - un financement soldé ou
-- annulé n'a jamais été implémenté, et aucun document ne fixe les valeurs terminales prévues ;
-- inventer un jeu de valeurs sans base documentée aurait risqué de figer le mauvais choix avant
-- que cette fonctionnalité n'existe réellement (voir E5, "verrouillage optimiste").
ALTER TABLE decaissements
    ADD CONSTRAINT ck_decaissements_statut CHECK (statut IN ('PREVU', 'EFFECTUE', 'ANNULE'));

ALTER TABLE echeances
    ADD CONSTRAINT ck_echeances_statut
    CHECK (statut IN ('A_VENIR', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'EN_RETARD'));
