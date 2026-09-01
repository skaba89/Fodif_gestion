-- Local Docker demonstration data only. Never apply to a hosted production database.

INSERT INTO regions (id, code, nom)
VALUES ('10000000-0000-4000-8000-000000000001', 'CONAKRY', 'Conakry')
ON CONFLICT (code) DO NOTHING;

INSERT INTO secteurs_activite (id, code, nom)
VALUES ('20000000-0000-4000-8000-000000000001', 'AGRO', 'Agro-industrie')
ON CONFLICT (code) DO NOTHING;

INSERT INTO entreprises (
    id, code_fodip, raison_sociale, nom_commercial, rccm, nif, secteur_id,
    description_activite, nombre_employes, chiffre_affaires_annuel,
    telephone, email, region_id, adresse
)
VALUES (
    '30000000-0000-4000-8000-000000000001', 'FODIP-PME-DEMO',
    'Kankan Agro Transformation SARL', 'KAT SARL', 'GN.CKY.2026.DEMO', 'NIF-DEMO-2026',
    '20000000-0000-4000-8000-000000000001',
    'Transformation et conditionnement de produits agricoles locaux', 18, 2400000000,
    '+224 600 00 00 00', 'contact@kat-demo.local',
    '10000000-0000-4000-8000-000000000001', 'Conakry, Guinée'
)
ON CONFLICT (code_fodip) DO NOTHING;

INSERT INTO entreprise_dirigeants (
    id, entreprise_id, nom, prenom, fonction, email, genre, dirigeant_principal
)
VALUES (
    '31000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'CAMARA', 'Aminata', 'Gérante', 'aminata@kat-demo.local', 'FEMME', TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO programmes_fodip (
    id, code, nom, description, montant_min, montant_max, statut
)
VALUES (
    '40000000-0000-4000-8000-000000000001', 'CROISSANCE-PME',
    'Programme Croissance PME', 'Financement de la croissance et de la création d’emplois',
    100000000, 2000000000, 'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO utilisateurs (id, email, nom, prenom, password_hash, actif, mfa_required)
VALUES
    ('50000000-0000-4000-8000-000000000001', 'agent@fodip.local', 'DIALLO', 'Mamadou',
     '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE),
    ('50000000-0000-4000-8000-000000000002', 'pme@fodip.local', 'CAMARA', 'Aminata',
     '$2b$12$/CmLG274z4XT2vEiOHGvB.x7.88nXoS.0mLc5ytOTaaiEQpFiZuoK', TRUE, FALSE)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    actif = TRUE;

INSERT INTO utilisateur_roles (utilisateur_id, role_id)
SELECT '50000000-0000-4000-8000-000000000001', id FROM roles WHERE code = 'AGENT_FODIP'
ON CONFLICT DO NOTHING;

INSERT INTO utilisateur_roles (utilisateur_id, role_id)
SELECT '50000000-0000-4000-8000-000000000002', id FROM roles WHERE code = 'PME'
ON CONFLICT DO NOTHING;

INSERT INTO utilisateur_entreprises (utilisateur_id, entreprise_id, relation, principal)
VALUES (
    '50000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001', 'OWNER', TRUE
)
ON CONFLICT DO NOTHING;

INSERT INTO dossiers_financement (
    id, numero_dossier, entreprise_id, programme_id, montant_demande,
    apport_personnel, objet_financement, description_projet,
    nombre_emplois_prevus, statut, date_soumission
)
VALUES
    (
      '60000000-0000-4000-8000-000000000001', 'FODIP-2026-DEMO01',
      '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
      750000000, 120000000, 'Nouvelle ligne de conditionnement',
      'Acquisition d’une ligne de conditionnement et renforcement du fonds de roulement.',
      12, 'SOUMIS', NOW() - INTERVAL '2 days'
    ),
    (
      '60000000-0000-4000-8000-000000000002', 'FODIP-2026-DEMO02',
      '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
      420000000, 80000000, 'Extension de la capacité de stockage',
      'Construction d’un espace de stockage adapté aux matières premières.',
      7, 'EN_INSTRUCTION', NOW() - INTERVAL '5 days'
    ),
    (
      '60000000-0000-4000-8000-000000000003', 'FODIP-2026-DEMO03',
      '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
      280000000, 50000000, 'Modernisation de l’atelier',
      'Brouillon réservé au test local du dépôt documentaire MinIO.',
      4, 'BROUILLON', NULL
    )
ON CONFLICT (numero_dossier) DO NOTHING;
