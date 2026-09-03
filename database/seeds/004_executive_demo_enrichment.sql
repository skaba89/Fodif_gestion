-- Mission "présentation Directeur général" (feat/dg-premium-presentation, section 8) - additive
-- enrichment of the existing Docker demo dataset (001/002/003), not a replacement: every INSERT
-- below is a new row (or, for the two UPDATEs, a field the existing rows never set), nothing here
-- removes or repurposes what 001-003 already seed. Adds exactly what the mission's demo-data list
-- asks for and the existing dataset didn't yet have: a second partner bank (only one existed),
-- dates de naissance for the existing dirigeants (none existed - the cockpit's "dirigeants jeunes"
-- KPI could only ever show "donnée indisponible" without this), a second active financing tied to
-- that second bank with a genuinely overdue, unpaid échéance (so the "points d'attention" bank
-- breakdown has more than one bank to actually break down), and an earlier suivi d'impact for an
-- existing PME (an "avant" data point next to the "après" 002 already seeds).

-- Dates de naissance : Aminata Camara et Ibrahima Bah nés après 1991 -> "jeunes" (<35 ans) au
-- dépôt de leur dossier ; Fatoumata Diallo et Moussa Keita nés avant -> pas "jeunes". Un mélange
-- réaliste, pas tout le monde dans la même tranche d'âge.
UPDATE entreprise_dirigeants SET date_naissance = '1993-04-12' WHERE id = '31000000-0000-4000-8000-000000000001'; -- Aminata Camara
UPDATE entreprise_dirigeants SET date_naissance = '1982-09-03' WHERE id = '31000000-0000-4000-8000-000000000002'; -- Fatoumata Diallo
UPDATE entreprise_dirigeants SET date_naissance = '1975-01-20' WHERE id = '31000000-0000-4000-8000-000000000003'; -- Moussa Keita
UPDATE entreprise_dirigeants SET date_naissance = '1996-11-30' WHERE id = '31000000-0000-4000-8000-000000000004'; -- Ibrahima Bah

INSERT INTO partenaires_bancaires (id, code, raison_sociale, actif)
VALUES ('90000000-0000-4000-8000-000000000002', 'BANQUE-DEMO-2', 'Banque Régionale Kindia SA', TRUE)
ON CONFLICT (code) DO UPDATE SET raison_sociale = EXCLUDED.raison_sociale, actif = TRUE;

-- Un second dossier pour Labé Distribution (30000000-...-04, déjà seedée par 002 avec un premier
-- dossier REJETE) - une PME peut avoir plusieurs dossiers dans le temps ; celui-ci est approuvé et
-- financé, contrairement au premier.
INSERT INTO dossiers_financement (
    id, numero_dossier, entreprise_id, programme_id, montant_demande, apport_personnel,
    objet_financement, nombre_emplois_prevus, statut, date_soumission, updated_at
)
VALUES (
    '60000000-0000-4000-8000-000000000007', 'FODIP-2026-DEMO07',
    '30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001',
    280000000, 35000000, 'Modernisation de l’entrepôt de distribution', 6, 'APPROUVE',
    NOW() - INTERVAL '55 days', NOW() - INTERVAL '48 days'
)
ON CONFLICT (numero_dossier) DO NOTHING;

INSERT INTO decisions_comite (
    id, dossier_id, decision, montant_approuve, taux_interet, duree_mois,
    commentaire, date_decision, created_by
)
VALUES (
    '72000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000007',
    'APPROUVE', 260000000, 8.0, 24, 'Bon historique de gestion, garanties suffisantes',
    NOW() - INTERVAL '48 days', '50000000-0000-4000-8000-000000000003'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO financements (
    id, numero_financement, dossier_id, entreprise_id, montant_accorde, taux_interet,
    duree_mois, date_signature, date_debut, date_fin_prevue, statut, banque_partenaire_id
)
VALUES (
    '80000000-0000-4000-8000-000000000002', 'FIN-2026-DEMO02',
    '60000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000004',
    260000000, 8.0, 24, CURRENT_DATE - 45, CURRENT_DATE - 42, CURRENT_DATE + 690, 'ACTIF',
    '90000000-0000-4000-8000-000000000002'
)
ON CONFLICT (numero_financement) DO NOTHING;

INSERT INTO decaissements (
    id, financement_id, numero_decaissement, montant, date_prevue, date_effective, reference_bancaire, statut
)
VALUES (
    '81000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000002', 1,
    260000000, CURRENT_DATE - 42, CURRENT_DATE - 42, 'DEC-DEMO-002', 'EFFECTUE'
)
ON CONFLICT (financement_id, numero_decaissement) DO NOTHING;

-- Échéance passée, entièrement impayée (aucun remboursement enregistré derrière) - contrairement
-- au financement 001 (déjà partiellement remboursé), celui-ci nourrit réellement l'alerte
-- "échéances en retard" et la ventilation par banque avec une seconde banque, pas seulement la
-- première.
INSERT INTO echeances (
    id, financement_id, numero_echeance, date_echeance, capital_du, interet_du, montant_total_du, statut
)
VALUES (
    '82000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', 1,
    CURRENT_DATE - 10, 10500000, 1700000, 12200000, 'EN_RETARD'
)
ON CONFLICT (financement_id, numero_echeance) DO NOTHING;

-- "Impact avant/après financement" (mission section 3) : un point de suivi antérieur au
-- financement, à côté du point "après" que 002_analytics_demo.sql seedait déjà pour cette même
-- PME (Kindia Fruits SARL) - une vraie paire avant/après, pas une valeur unique.
INSERT INTO suivis_impact (
    id, entreprise_id, financement_id, periode, chiffre_affaires, nombre_employes,
    emplois_femmes, emplois_hommes, emplois_jeunes, emplois_crees, emplois_maintenus, production_locale
)
VALUES (
    '84000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', NULL,
    CURRENT_DATE - 210, 1450000000, 22, 10, 12, 6, 0, 22, 1100000000
)
ON CONFLICT (id) DO NOTHING;
