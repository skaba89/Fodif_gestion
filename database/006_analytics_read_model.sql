-- Step 11: Docker-native analytical read model.
-- These views isolate dashboard consumers from transactional table details.

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE OR REPLACE VIEW analytics.vw_dossier_portfolio AS
SELECT
    d.id AS dossier_id,
    d.numero_dossier,
    d.entreprise_id,
    e.raison_sociale,
    e.region_id,
    COALESCE(r.nom, 'Non renseignée') AS region_nom,
    e.secteur_id,
    COALESCE(s.nom, 'Non renseigné') AS secteur_nom,
    d.programme_id,
    COALESCE(p.nom, 'Sans programme') AS programme_nom,
    d.montant_demande,
    d.apport_personnel,
    d.nombre_emplois_prevus,
    d.statut,
    d.date_soumission,
    d.created_at,
    d.updated_at,
    latest_score.score_total,
    latest_score.niveau_risque,
    latest_score.recommandation,
    latest_decision.decision,
    latest_decision.montant_approuve,
    latest_decision.date_decision
FROM dossiers_financement d
JOIN entreprises e ON e.id = d.entreprise_id AND e.deleted_at IS NULL
LEFT JOIN regions r ON r.id = e.region_id
LEFT JOIN secteurs_activite s ON s.id = e.secteur_id
LEFT JOIN programmes_fodip p ON p.id = d.programme_id
LEFT JOIN LATERAL (
    SELECT score_total, niveau_risque, recommandation
    FROM scores_dossier score
    WHERE score.dossier_id = d.id
    ORDER BY score.updated_at DESC, score.calcule_at DESC
    LIMIT 1
) latest_score ON TRUE
LEFT JOIN LATERAL (
    SELECT decision, montant_approuve, date_decision
    FROM decisions_comite decision
    WHERE decision.dossier_id = d.id
    ORDER BY decision.date_decision DESC
    LIMIT 1
) latest_decision ON TRUE;

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
    GREATEST(COALESCE(due.montant_du, 0) - COALESCE(paid.montant_rembourse, 0), 0) AS impaye
FROM financements f
JOIN dossiers_financement d ON d.id = f.dossier_id
JOIN entreprises e ON e.id = f.entreprise_id AND e.deleted_at IS NULL
LEFT JOIN regions r ON r.id = e.region_id
LEFT JOIN secteurs_activite s ON s.id = e.secteur_id
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

CREATE OR REPLACE VIEW analytics.vw_latest_impact AS
SELECT DISTINCT ON (impact.entreprise_id)
    impact.entreprise_id,
    impact.financement_id,
    dossier.programme_id,
    entreprise.region_id,
    entreprise.secteur_id,
    impact.periode,
    impact.chiffre_affaires,
    impact.nombre_employes,
    impact.emplois_femmes,
    impact.emplois_hommes,
    impact.emplois_jeunes,
    impact.emplois_crees,
    impact.emplois_maintenus,
    impact.production_locale,
    impact.created_at
FROM suivis_impact impact
JOIN entreprises entreprise ON entreprise.id = impact.entreprise_id AND entreprise.deleted_at IS NULL
LEFT JOIN financements financement ON financement.id = impact.financement_id
LEFT JOIN dossiers_financement dossier ON dossier.id = financement.dossier_id
ORDER BY impact.entreprise_id, impact.periode DESC, impact.created_at DESC;
