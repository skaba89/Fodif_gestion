-- FODIP Digital 2030
-- PME portal incremental migration. Additive only.

CREATE SEQUENCE IF NOT EXISTS dossier_numero_seq START WITH 1 INCREMENT BY 1;

INSERT INTO permissions (code, description)
VALUES
    ('program.read', 'Lire les programmes de financement actifs'),
    ('application.own.update', 'Modifier un dossier appartenant à sa propre entreprise tant que son statut le permet'),
    ('application.own.submit', 'Soumettre un brouillon appartenant à sa propre entreprise')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

WITH mappings(role_code, permission_code) AS (
    VALUES
      ('PME', 'program.read'),
      ('PME', 'application.own.update'),
      ('PME', 'application.own.submit')
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
