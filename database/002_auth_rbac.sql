-- FODIP Digital 2030
-- Authentication ownership links and initial RBAC reference data.

CREATE TABLE IF NOT EXISTS utilisateur_entreprises (
    utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
    relation VARCHAR(50) NOT NULL DEFAULT 'OWNER',
    principal BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (utilisateur_id, entreprise_id)
);

CREATE INDEX IF NOT EXISTS idx_utilisateur_entreprises_entreprise
    ON utilisateur_entreprises(entreprise_id, utilisateur_id);

INSERT INTO roles (code, nom, description)
VALUES
    ('SUPER_ADMIN', 'Super administrateur', 'Administration technique complète de la plateforme'),
    ('DIRECTION_FODIP', 'Direction FODIP', 'Pilotage national et lecture des indicateurs consolidés'),
    ('AGENT_FODIP', 'Agent FODIP', 'Instruction et vérification des dossiers'),
    ('ANALYSTE', 'Analyste', 'Analyse financière, portefeuille et impact'),
    ('COMITE_FINANCEMENT', 'Comité de financement', 'Consultation et décision sur les dossiers'),
    ('PARTENAIRE_BANCAIRE', 'Partenaire bancaire', 'Accès API partenaire strictement limité'),
    ('PME', 'PME', 'Accès entrepreneur limité à ses propres données'),
    ('AUDITEUR', 'Auditeur', 'Accès en lecture aux éléments nécessaires à l’audit')
ON CONFLICT (code) DO UPDATE
SET nom = EXCLUDED.nom,
    description = EXCLUDED.description;

INSERT INTO permissions (code, description)
VALUES
    ('dashboard.read', 'Lire les tableaux de bord institutionnels'),
    ('company.read', 'Lire les entreprises'),
    ('company.update', 'Modifier les entreprises dans le périmètre autorisé'),
    ('company.own.read', 'Lire sa propre entreprise'),
    ('company.own.update', 'Modifier sa propre entreprise'),
    ('application.read', 'Lire les dossiers de financement'),
    ('application.review', 'Instruire un dossier de financement'),
    ('application.own.create', 'Créer un dossier pour sa propre entreprise'),
    ('application.own.read', 'Lire ses propres dossiers'),
    ('document.read', 'Lire les documents des dossiers autorisés'),
    ('document.verify', 'Vérifier les documents d’un dossier'),
    ('document.own.upload', 'Téléverser des documents sur son propre dossier'),
    ('scoring.read', 'Lire les scores et analyses'),
    ('decision.create', 'Créer une décision de comité'),
    ('financing.read', 'Lire les financements'),
    ('impact.read', 'Lire les indicateurs d’impact'),
    ('audit.read', 'Lire les traces d’audit'),
    ('partner.application.read', 'Lire un dossier exposé à un partenaire'),
    ('partner.disbursement.create', 'Déclarer un décaissement partenaire'),
    ('partner.repayment.create', 'Déclarer un remboursement partenaire')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

WITH mappings(role_code, permission_code) AS (
    VALUES
      ('DIRECTION_FODIP', 'dashboard.read'),
      ('DIRECTION_FODIP', 'company.read'),
      ('DIRECTION_FODIP', 'application.read'),
      ('DIRECTION_FODIP', 'financing.read'),
      ('DIRECTION_FODIP', 'impact.read'),
      ('AGENT_FODIP', 'company.read'),
      ('AGENT_FODIP', 'company.update'),
      ('AGENT_FODIP', 'application.read'),
      ('AGENT_FODIP', 'application.review'),
      ('AGENT_FODIP', 'document.read'),
      ('AGENT_FODIP', 'document.verify'),
      ('AGENT_FODIP', 'scoring.read'),
      ('ANALYSTE', 'dashboard.read'),
      ('ANALYSTE', 'company.read'),
      ('ANALYSTE', 'application.read'),
      ('ANALYSTE', 'financing.read'),
      ('ANALYSTE', 'impact.read'),
      ('COMITE_FINANCEMENT', 'application.read'),
      ('COMITE_FINANCEMENT', 'scoring.read'),
      ('COMITE_FINANCEMENT', 'decision.create'),
      ('PME', 'company.own.read'),
      ('PME', 'company.own.update'),
      ('PME', 'application.own.create'),
      ('PME', 'application.own.read'),
      ('PME', 'document.own.upload'),
      ('AUDITEUR', 'audit.read'),
      ('AUDITEUR', 'financing.read'),
      ('AUDITEUR', 'impact.read'),
      ('PARTENAIRE_BANCAIRE', 'partner.application.read'),
      ('PARTENAIRE_BANCAIRE', 'partner.disbursement.create'),
      ('PARTENAIRE_BANCAIRE', 'partner.repayment.create')
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
