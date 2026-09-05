-- Local Docker demonstration data for axe D1 (bank partners). Exercises both scoping mechanisms
-- from database/011_partner_banks.sql: the demo partner is the correspondent bank on one existing
-- financing AND has one PME client in its own portfolio, independently of that financing.

INSERT INTO partenaires_bancaires (id, code, raison_sociale, actif)
VALUES ('90000000-0000-4000-8000-000000000001', 'BANQUE-DEMO', 'Banque Partenaire Démo SA', TRUE)
ON CONFLICT (code) DO UPDATE SET raison_sociale = EXCLUDED.raison_sociale, actif = TRUE;

INSERT INTO utilisateurs (id, email, nom, prenom, password_hash, actif, mfa_required, partenaire_bancaire_id)
VALUES (
    '50000000-0000-4000-8000-000000000007', 'partenaire@fodip.local', 'CISSE', 'Fode',
    '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE,
    '90000000-0000-4000-8000-000000000001'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash, actif = TRUE, partenaire_bancaire_id = EXCLUDED.partenaire_bancaire_id;

INSERT INTO utilisateur_roles (utilisateur_id, role_id)
SELECT '50000000-0000-4000-8000-000000000007', id FROM roles WHERE code = 'PARTENAIRE_BANCAIRE'
ON CONFLICT DO NOTHING;

-- Correspondent-bank scoping: the demo partner executes disbursements/repayments for the demo
-- financing created in 002_analytics_demo.sql.
UPDATE financements SET banque_partenaire_id = '90000000-0000-4000-8000-000000000001'
WHERE id = '80000000-0000-4000-8000-000000000001';

-- Client-portfolio scoping: the demo partner also has visibility over Kindia Fruits SARL as a
-- client, independently of which bank happens to correspond for any one of its financings.
INSERT INTO partenaire_entreprises (partenaire_id, entreprise_id)
VALUES ('90000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- Matching audit trail (see the equivalent block at the end of 002_analytics_demo.sql) for the
-- disbursement/repayment already seeded there (decaissements/remboursements 81.../83...) - written
-- here, after the partner account exists, as PARTNER_DECLARE_* (partner.repository.ts) rather than
-- the direction-side PLAN_DISBURSEMENT (financings.repository.ts): this bank is the correspondent
-- for this financing, so in the real flow the partner declares its own disbursements/repayments.
INSERT INTO audit_logs (id, utilisateur_id, action, entity_type, entity_id, new_values, created_at)
VALUES
    ('85000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000007',
     'PARTNER_DECLARE_DISBURSEMENT', 'DECAISSEMENT', '81000000-0000-4000-8000-000000000001',
     '{"reference": "DEC-DEMO-001", "montant": 400000000}', CURRENT_DATE - 14),
    ('85000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000007',
     'PARTNER_DECLARE_REPAYMENT', 'REMBOURSEMENT', '83000000-0000-4000-8000-000000000001',
     '{"reference": "REM-DEMO-001", "montant": 60000000}', CURRENT_DATE - 1)
ON CONFLICT (id) DO NOTHING;

-- Rapprochement bancaire (axe E5) : un décaissement déjà contrôlé et un remboursement encore à
-- rapprocher permettent à l'écran Direction de démontrer les deux états sans données fictives
-- codées en dur dans le frontend.
INSERT INTO mouvements_bancaires (
    id, partenaire_bancaire_id, reference_externe, date_operation, sens, montant,
    libelle, lot_import, created_by, created_at
)
VALUES
    ('86000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
     'REL-DEMO-DEC-001', CURRENT_DATE - 14, 'DEBIT', 400000000,
     'Décaissement PME Démo', 'DEMO-2026-09', '50000000-0000-4000-8000-000000000004', CURRENT_DATE - 13),
    ('86000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
     'REL-DEMO-REM-001', CURRENT_DATE - 1, 'CREDIT', 60000000,
     'Remboursement PME Démo', 'DEMO-2026-09', '50000000-0000-4000-8000-000000000004', CURRENT_DATE - 1)
ON CONFLICT (partenaire_bancaire_id, reference_externe) DO NOTHING;

INSERT INTO rapprochements_bancaires (
    id, mouvement_bancaire_id, decaissement_id, commentaire, rapproche_par, rapproche_at
)
VALUES (
    '87000000-0000-4000-8000-000000000001', '86000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001', 'Référence et montant contrôlés.',
    '50000000-0000-4000-8000-000000000004', CURRENT_DATE - 13
)
ON CONFLICT (mouvement_bancaire_id) DO NOTHING;

INSERT INTO audit_logs (id, utilisateur_id, action, entity_type, entity_id, new_values, created_at)
VALUES (
    '85000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000004',
    'RECONCILE_BANK_ENTRY', 'RAPPROCHEMENT_BANCAIRE', '87000000-0000-4000-8000-000000000001',
    '{"mouvementBancaireId":"86000000-0000-4000-8000-000000000001","operationType":"DECAISSEMENT","operationId":"81000000-0000-4000-8000-000000000001","montant":400000000,"banqueId":"90000000-0000-4000-8000-000000000001"}',
    CURRENT_DATE - 13
)
ON CONFLICT (id) DO NOTHING;
