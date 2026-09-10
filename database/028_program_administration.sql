-- FODIP Digital 2030
-- Institutional programme administration: role-scoped management + maker-checker evidence.
-- Additive only. No official programme value is created by this migration.

ALTER TABLE programme_regles_versions
    ADD COLUMN IF NOT EXISTS prepared_by UUID REFERENCES utilisateurs(id),
    ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES utilisateurs(id),
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES utilisateurs(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_programme_regles_review
    ON programme_regles_versions(programme_id, statut, submitted_at DESC);

INSERT INTO permissions (code, description)
VALUES
    ('program.read', 'Lire le référentiel des programmes de financement autorisés'),
    ('program.manage', 'Créer et paramétrer les programmes et leurs versions de règles'),
    ('program.approve', 'Valider et activer une version de règles après revue par un second acteur')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

WITH mappings(role_code, permission_code) AS (
    VALUES
      ('PME', 'program.read'),
      ('AGENT_FODIP', 'program.read'),
      ('COMITE_FINANCEMENT', 'program.read'),
      ('DIRECTION_FODIP', 'program.read'),
      ('ANALYSTE', 'program.read'),
      ('AUDITEUR', 'program.read'),
      ('DIRECTION_FODIP', 'program.manage'),
      ('DIRECTION_FODIP', 'program.approve')
)
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM mappings m
JOIN roles r ON r.code = m.role_code
JOIN permissions p ON p.code = m.permission_code
ON CONFLICT DO NOTHING;

-- SUPER_ADMIN remains the technical break-glass administrator for every declared permission.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;
