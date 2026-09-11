-- Local Docker/CI qualification accounts only. Never apply to a hosted production database.
-- These identities isolate the exhaustive role/page Playwright matrix from the real login
-- rate-limit budget used by the historical demo accounts.

INSERT INTO utilisateurs (
    id, email, nom, prenom, password_hash, actif, mfa_required, partenaire_bancaire_id
)
VALUES
    ('59000000-0000-4000-8000-000000000001', 'qualification-pme@fodip.local', 'QUALIFICATION', 'PME',
     '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE, NULL),
    ('59000000-0000-4000-8000-000000000002', 'qualification-agent@fodip.local', 'QUALIFICATION', 'Agent',
     '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE, NULL),
    ('59000000-0000-4000-8000-000000000003', 'qualification-comite@fodip.local', 'QUALIFICATION', 'Comité',
     '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE, NULL),
    ('59000000-0000-4000-8000-000000000004', 'qualification-direction@fodip.local', 'QUALIFICATION', 'Direction',
     '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE, NULL),
    ('59000000-0000-4000-8000-000000000005', 'qualification-analyste@fodip.local', 'QUALIFICATION', 'Analyste',
     '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE, NULL),
    ('59000000-0000-4000-8000-000000000006', 'qualification-auditeur@fodip.local', 'QUALIFICATION', 'Auditeur',
     '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE, NULL),
    ('59000000-0000-4000-8000-000000000007', 'qualification-partenaire@fodip.local', 'QUALIFICATION', 'Partenaire',
     '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE,
     '90000000-0000-4000-8000-000000000001'),
    ('59000000-0000-4000-8000-000000000008', 'qualification-admin@fodip.local', 'QUALIFICATION', 'Admin',
     '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE, NULL)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    actif = TRUE,
    mfa_required = FALSE,
    partenaire_bancaire_id = EXCLUDED.partenaire_bancaire_id;

INSERT INTO utilisateur_roles (utilisateur_id, role_id)
SELECT account.utilisateur_id, roles.id
FROM (
    VALUES
        ('59000000-0000-4000-8000-000000000001'::uuid, 'PME'),
        ('59000000-0000-4000-8000-000000000002'::uuid, 'AGENT_FODIP'),
        ('59000000-0000-4000-8000-000000000003'::uuid, 'COMITE_FINANCEMENT'),
        ('59000000-0000-4000-8000-000000000004'::uuid, 'DIRECTION_FODIP'),
        ('59000000-0000-4000-8000-000000000005'::uuid, 'ANALYSTE'),
        ('59000000-0000-4000-8000-000000000006'::uuid, 'AUDITEUR'),
        ('59000000-0000-4000-8000-000000000007'::uuid, 'PARTENAIRE_BANCAIRE'),
        ('59000000-0000-4000-8000-000000000008'::uuid, 'SUPER_ADMIN')
) AS account(utilisateur_id, role_code)
JOIN roles ON roles.code = account.role_code
ON CONFLICT DO NOTHING;

-- PME pages need an owned enterprise; partner pages scope through partenaire_bancaire_id above.
INSERT INTO utilisateur_entreprises (utilisateur_id, entreprise_id, relation, principal)
VALUES (
    '59000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'OWNER', TRUE
)
ON CONFLICT DO NOTHING;
