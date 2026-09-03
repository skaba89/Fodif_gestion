-- Mission "présentation Directeur général" (feat/dg-premium-presentation) - additive extension of
-- the Step 11 analytics read model (006_analytics_read_model.sql) for the executive cockpit's
-- new bank filter and per-bank "points d'attention" alerts. `CREATE OR REPLACE VIEW` only adds
-- columns here - every column the cockpit already reads (region_id, secteur_id, montant_decaisse,
-- montant_du, montant_rembourse, impaye, ...) keeps its exact name, meaning AND ordinal position,
-- so nothing that already queries this view before this migration breaks after it. The two new
-- columns are appended at the very end of the SELECT list rather than placed next to the other
-- `financing.*` columns they're conceptually closest to (secteur_id/secteur_nom) - verified the
-- hard way, not assumed: PostgreSQL's CREATE OR REPLACE VIEW only allows appending columns:
-- inserting a column in the middle renumbers every column after it, and Postgres refuses that
-- with "cannot change name of view column ... to ..." even though every column's own name and
-- type stay the same - caught by this migration's own integration test
-- (test/integration/analytics.integration-spec.ts) before this ever reached CI.

CREATE OR REPLACE VIEW analytics.vw_financing_performance AS
SELECT
    f.id AS financement_id,
    f.dossier_id,
    f.entreprise_id,
    d.programme_id,
    e.region_id,
    COALESCE(r.nom, 'Non renseignée') AS region_nom,
    e.secteur_id,
    COALESCE(s.nom, 'Non renseigné') AS secteur_nom,
    f.montant_accorde,
    f.statut,
    f.created_at,
    COALESCE(disbursed.montant_decaisse, 0) AS montant_decaisse,
    COALESCE(due.montant_du, 0) AS montant_du,
    COALESCE(paid.montant_rembourse, 0) AS montant_rembourse,
    GREATEST(COALESCE(due.montant_du, 0) - COALESCE(paid.montant_rembourse, 0), 0) AS impaye,
    f.banque_partenaire_id,
    banque.raison_sociale AS banque_nom
FROM financements f
JOIN dossiers_financement d ON d.id = f.dossier_id
JOIN entreprises e ON e.id = f.entreprise_id AND e.deleted_at IS NULL
LEFT JOIN regions r ON r.id = e.region_id
LEFT JOIN secteurs_activite s ON s.id = e.secteur_id
LEFT JOIN partenaires_bancaires banque ON banque.id = f.banque_partenaire_id
LEFT JOIN LATERAL (
    SELECT SUM(montant) AS montant_decaisse
    FROM decaissements decaissement
    WHERE decaissement.financement_id = f.id AND decaissement.statut = 'EFFECTUE'
) disbursed ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(montant_total_du) AS montant_du
    FROM echeances echeance
    WHERE echeance.financement_id = f.id AND echeance.date_echeance <= CURRENT_DATE
) due ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(montant_paye) AS montant_rembourse
    FROM remboursements remboursement
    WHERE remboursement.financement_id = f.id
) paid ON TRUE;
