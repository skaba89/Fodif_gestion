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
