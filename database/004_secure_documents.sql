-- FODIP Digital 2030
-- Secure document storage metadata and least-privilege RBAC.

ALTER TABLE dossier_documents
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES utilisateurs(id),
    ADD COLUMN IF NOT EXISTS verification_comment TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_dossier_documents_storage_key
    ON dossier_documents(storage_key);

CREATE INDEX IF NOT EXISTS idx_documents_verification
    ON dossier_documents(statut_verification, created_at DESC);

INSERT INTO permissions (code, description)
VALUES
    ('document.own.read', 'Lister et télécharger les documents de ses propres dossiers')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

WITH mappings(role_code, permission_code) AS (
    VALUES
      ('PME', 'document.own.read')
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
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;
