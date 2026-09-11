-- FODIP Digital 2030
-- Default institutional reference data + governed programme proposals.
-- Additive and idempotent: existing operational data is preserved.

-- Provenance and ownership make user-created programmes distinguishable from the
-- verified institutional defaults and allow server-side ownership checks.
ALTER TABLE programmes_fodip
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES utilisateurs(id),
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS source_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_programmes_created_by
    ON programmes_fodip(created_by, created_at DESC)
    WHERE created_by IS NOT NULL;

-- A programme with no explicit region/sector association is nationwide / all sectors.
CREATE TABLE IF NOT EXISTS programme_regions (
    programme_id UUID NOT NULL REFERENCES programmes_fodip(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES regions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (programme_id, region_id)
);

CREATE TABLE IF NOT EXISTS programme_secteurs (
    programme_id UUID NOT NULL REFERENCES programmes_fodip(id) ON DELETE CASCADE,
    secteur_id UUID NOT NULL REFERENCES secteurs_activite(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (programme_id, secteur_id)
);

CREATE INDEX IF NOT EXISTS idx_programme_regions_region
    ON programme_regions(region_id, programme_id);
CREATE INDEX IF NOT EXISTS idx_programme_secteurs_secteur
    ON programme_secteurs(secteur_id, programme_id);

-- Guinea operational top-level regions: seven administrative regions + Conakry.
INSERT INTO regions(code, nom)
VALUES
    ('CONAKRY', 'Conakry'),
    ('BOKE', 'Boké'),
    ('KINDIA', 'Kindia'),
    ('MAMOU', 'Mamou'),
    ('LABE', 'Labé'),
    ('FARANAH', 'Faranah'),
    ('KANKAN', 'Kankan'),
    ('NZEREKORE', 'N''Zérékoré')
ON CONFLICT (code) DO UPDATE SET nom = EXCLUDED.nom;

-- Public FODIP eligibility / intervention sectors. Parent relationships remain free
-- for later controlled sub-sector extensions without changing these stable codes.
INSERT INTO secteurs_activite(code, nom, actif)
VALUES
    ('AGRICULTURE', 'Agriculture', TRUE),
    ('AGRO_INDUSTRIE', 'Agro-industrie', TRUE),
    ('TRANSFORMATION', 'Transformation', TRUE),
    ('COMMERCE', 'Commerce', TRUE),
    ('SERVICES', 'Services', TRUE),
    ('INDUSTRIE', 'Industrie', TRUE),
    ('TECHNOLOGIE', 'Technologie', TRUE),
    ('ARTISANAT', 'Artisanat', TRUE),
    ('TOURISME', 'Tourisme', TRUE),
    ('LOGISTIQUE_TRANSPORT', 'Logistique & Transport', TRUE)
ON CONFLICT (code) DO UPDATE
SET nom = EXCLUDED.nom,
    actif = TRUE;

-- Programme proposal permission is intentionally separated from programme management.
-- Internal operational users may prepare proposals; only Direction keeps approval and activation.
INSERT INTO permissions(code, description)
VALUES ('program.propose', 'Créer, modifier et soumettre ses propres propositions de programmes')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

WITH mappings(role_code, permission_code) AS (
    VALUES
      ('AGENT_FODIP', 'program.propose'),
      ('ANALYSTE', 'program.propose'),
      ('DIRECTION_FODIP', 'program.propose')
)
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM mappings m
JOIN roles r ON r.code = m.role_code
JOIN permissions p ON p.code = m.permission_code
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'program.propose'
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- Verified public FODIP financing lines available on fodip.gov.gn in September 2026.
-- We deliberately do not infer applicant min/max amounts, contribution rates or document
-- requirements from public envelope labels. Those criteria remain NULL until formally configured.
INSERT INTO programmes_fodip(
    code, nom, description, date_debut, date_fin, statut, is_default, source_reference
)
VALUES
    (
      'FIER-BOOST',
      'FIER BOOST',
      'Ligne de financement FODIP référencée publiquement. Les critères détaillés restent à valider dans la version de règles.',
      DATE '2026-09-09', DATE '2026-10-23', 'ACTIVE', TRUE,
      'https://fodip.gov.gn/'
    ),
    (
      'EXPORT-TRANSFORMATION',
      'GUICHET EXPORT ET TRANSFORMATION',
      'Ligne de financement FODIP référencée publiquement. Les critères détaillés restent à valider dans la version de règles.',
      DATE '2026-09-04', DATE '2026-09-30', 'ACTIVE', TRUE,
      'https://fodip.gov.gn/'
    ),
    (
      'ELLEVER',
      'ELLEVER',
      'Ligne de financement FODIP référencée publiquement. Les critères détaillés restent à valider dans la version de règles.',
      DATE '2026-08-05', DATE '2026-09-17', 'ACTIVE', TRUE,
      'https://fodip.gov.gn/'
    )
ON CONFLICT (code) DO UPDATE
SET nom = EXCLUDED.nom,
    description = EXCLUDED.description,
    date_debut = EXCLUDED.date_debut,
    date_fin = EXCLUDED.date_fin,
    is_default = TRUE,
    source_reference = EXCLUDED.source_reference,
    updated_at = NOW();

-- Give each default programme a minimal active V1 only when it has no rule version yet.
-- The version contains no invented financial/eligibility criteria and can later be superseded
-- through the normal maker-checker versioning workflow.
INSERT INTO programme_regles_versions(
    programme_id, version, statut, effective_from,
    montant_min, montant_max, apport_min_pct, anciennete_min_mois,
    rccm_requis, nif_requis, sla_instruction_jours
)
SELECT
    p.id, 1, 'ACTIVE', COALESCE(p.date_debut::timestamptz, NOW()),
    NULL, NULL, NULL, NULL, FALSE, FALSE, NULL
FROM programmes_fodip p
WHERE p.code IN ('FIER-BOOST', 'EXPORT-TRANSFORMATION', 'ELLEVER')
  AND NOT EXISTS (
      SELECT 1 FROM programme_regles_versions existing
      WHERE existing.programme_id = p.id
  );
