-- Multi-region analytical demonstration data for the Docker cockpit.

INSERT INTO regions (id, code, nom)
VALUES
    ('10000000-0000-4000-8000-000000000002', 'KINDIA', 'Kindia'),
    ('10000000-0000-4000-8000-000000000003', 'KANKAN', 'Kankan'),
    ('10000000-0000-4000-8000-000000000004', 'LABE', 'Labé')
ON CONFLICT (code) DO NOTHING;

INSERT INTO secteurs_activite (id, code, nom)
VALUES
    ('20000000-0000-4000-8000-000000000002', 'COMMERCE', 'Commerce'),
    ('20000000-0000-4000-8000-000000000003', 'TECH', 'Technologies numériques')
ON CONFLICT (code) DO NOTHING;

INSERT INTO programmes_fodip (id, code, nom, description, montant_min, montant_max, statut)
VALUES (
    '40000000-0000-4000-8000-000000000002', 'JEUNES-PME', 'Programme Jeunes Entrepreneurs',
    'Soutien aux PME portées par des entrepreneurs de moins de 35 ans', 50000000, 1000000000, 'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO entreprises (
    id, code_fodip, raison_sociale, rccm, nif, secteur_id, nombre_employes,
    chiffre_affaires_annuel, region_id, statut
)
VALUES
    ('30000000-0000-4000-8000-000000000002', 'FODIP-PME-KINDIA', 'Kindia Fruits SARL',
     'GN.KD.2026.DEMO2', 'NIF-DEMO-2026-2', '20000000-0000-4000-8000-000000000001', 22, 1800000000,
     '10000000-0000-4000-8000-000000000002', 'ACTIVE'),
    ('30000000-0000-4000-8000-000000000003', 'FODIP-PME-KANKAN', 'Kankan Digital Services',
     'GN.KA.2026.DEMO3', 'NIF-DEMO-2026-3', '20000000-0000-4000-8000-000000000003', 9, 720000000,
     '10000000-0000-4000-8000-000000000003', 'ACTIVE'),
    ('30000000-0000-4000-8000-000000000004', 'FODIP-PME-LABE', 'Labé Distribution',
     'GN.LA.2026.DEMO4', 'NIF-DEMO-2026-4', '20000000-0000-4000-8000-000000000002', 14, 950000000,
     '10000000-0000-4000-8000-000000000004', 'ACTIVE')
ON CONFLICT (code_fodip) DO NOTHING;

INSERT INTO entreprise_dirigeants (id, entreprise_id, nom, prenom, fonction, genre, dirigeant_principal)
VALUES
    ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'DIALLO', 'Fatoumata', 'Gérante', 'FEMME', TRUE),
    ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'KEITA', 'Moussa', 'Directeur', 'HOMME', TRUE),
    ('31000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 'BAH', 'Ibrahima', 'Gérant', 'HOMME', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO utilisateurs (id, email, nom, prenom, password_hash, actif, mfa_required)
VALUES (
    '50000000-0000-4000-8000-000000000004', 'direction@fodip.local', 'TOURE', 'Aïssatou',
    '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, actif = TRUE;

INSERT INTO utilisateur_roles (utilisateur_id, role_id)
SELECT '50000000-0000-4000-8000-000000000004', id FROM roles WHERE code = 'DIRECTION_FODIP'
ON CONFLICT DO NOTHING;

INSERT INTO utilisateurs (id, email, nom, prenom, password_hash, actif, mfa_required)
VALUES (
    '50000000-0000-4000-8000-000000000006', 'auditeur@fodip.local', 'SOUMAH', 'Alpha',
    '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, actif = TRUE;

INSERT INTO utilisateur_roles (utilisateur_id, role_id)
SELECT '50000000-0000-4000-8000-000000000006', id FROM roles WHERE code = 'AUDITEUR'
ON CONFLICT DO NOTHING;

INSERT INTO dossiers_financement (
    id, numero_dossier, entreprise_id, programme_id, montant_demande, apport_personnel,
    objet_financement, nombre_emplois_prevus, statut, date_soumission, updated_at
)
VALUES
    ('60000000-0000-4000-8000-000000000004', 'FODIP-2026-DEMO04',
     '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001',
     600000000, 90000000, 'Chaîne de séchage de fruits', 10, 'APPROUVE', NOW() - INTERVAL '25 days', NOW() - INTERVAL '20 days'),
    ('60000000-0000-4000-8000-000000000005', 'FODIP-2026-DEMO05',
     '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002',
     350000000, 40000000, 'Plateforme numérique pour commerçants', 8, 'PRET_COMITE', NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day'),
    ('60000000-0000-4000-8000-000000000006', 'FODIP-2026-DEMO06',
     '30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001',
     240000000, 30000000, 'Extension du réseau de distribution', 5, 'REJETE', NOW() - INTERVAL '40 days', NOW() - INTERVAL '32 days')
ON CONFLICT (numero_dossier) DO NOTHING;

INSERT INTO decisions_comite (
    id, dossier_id, decision, montant_approuve, taux_interet, duree_mois,
    commentaire, date_decision, created_by
)
VALUES
    ('72000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000004',
     'APPROUVE', 550000000, 7.25, 36, 'Projet viable et créateur d’emplois', NOW() - INTERVAL '20 days',
     '50000000-0000-4000-8000-000000000003'),
    ('72000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000006',
     'REJETE', NULL, NULL, NULL, 'Capacité de remboursement insuffisante', NOW() - INTERVAL '32 days',
     '50000000-0000-4000-8000-000000000003')
ON CONFLICT (id) DO NOTHING;

INSERT INTO financements (
    id, numero_financement, dossier_id, entreprise_id, montant_accorde, taux_interet,
    duree_mois, date_signature, date_debut, date_fin_prevue, statut
)
VALUES (
    '80000000-0000-4000-8000-000000000001', 'FIN-2026-DEMO01',
    '60000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002',
    550000000, 7.25, 36, CURRENT_DATE - 18, CURRENT_DATE - 15, CURRENT_DATE + 1080, 'ACTIF'
)
ON CONFLICT (numero_financement) DO NOTHING;

INSERT INTO decaissements (
    id, financement_id, numero_decaissement, montant, date_prevue, date_effective, reference_bancaire, statut
)
VALUES
    ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 1,
     400000000, CURRENT_DATE - 14, CURRENT_DATE - 14, 'DEC-DEMO-001', 'EFFECTUE'),
    ('81000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000001', 2,
     150000000, CURRENT_DATE + 30, NULL, NULL, 'PREVU')
ON CONFLICT (financement_id, numero_decaissement) DO NOTHING;

INSERT INTO echeances (
    id, financement_id, numero_echeance, date_echeance, capital_du, interet_du, montant_total_du, statut
)
VALUES (
    '82000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 1,
    CURRENT_DATE - 2, 90000000, 10000000, 100000000, 'PARTIELLEMENT_PAYEE'
)
ON CONFLICT (financement_id, numero_echeance) DO NOTHING;

INSERT INTO remboursements (
    id, financement_id, echeance_id, montant_paye, date_paiement, reference_paiement, moyen_paiement
)
VALUES (
    '83000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 60000000, CURRENT_DATE - 1, 'REM-DEMO-001', 'VIREMENT'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO suivis_impact (
    id, entreprise_id, financement_id, periode, chiffre_affaires, nombre_employes,
    emplois_femmes, emplois_hommes, emplois_jeunes, emplois_crees, emplois_maintenus, production_locale
)
VALUES
    ('84000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
     '80000000-0000-4000-8000-000000000001', CURRENT_DATE - 1, 2300000000, 30, 14, 16, 17, 8, 22, 1750000000),
    ('84000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001',
     NULL, CURRENT_DATE - 3, 2550000000, 22, 12, 10, 13, 4, 18, 1900000000)
ON CONFLICT (id) DO NOTHING;
