-- Step 12: operational financing lifecycle and auditable financial events.

CREATE SEQUENCE IF NOT EXISTS financement_numero_seq START WITH 1;

ALTER TABLE financements ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES utilisateurs(id);
ALTER TABLE decaissements ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES utilisateurs(id);
ALTER TABLE remboursements ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES utilisateurs(id);
ALTER TABLE suivis_impact ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES utilisateurs(id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financements_dossier ON financements(dossier_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_suivis_impact_financement_periode
    ON suivis_impact(financement_id, periode) WHERE financement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decaissements_financement_statut
    ON decaissements(financement_id, statut);
CREATE INDEX IF NOT EXISTS idx_remboursements_echeance
    ON remboursements(echeance_id, date_paiement);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_financements_duree') THEN
    ALTER TABLE financements ADD CONSTRAINT ck_financements_duree CHECK (duree_mois BETWEEN 1 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_decaissements_dates') THEN
    ALTER TABLE decaissements ADD CONSTRAINT ck_decaissements_dates
      CHECK (statut <> 'EFFECTUE' OR (date_effective IS NOT NULL AND reference_bancaire IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_impact_non_negative') THEN
    ALTER TABLE suivis_impact ADD CONSTRAINT ck_impact_non_negative CHECK (
      COALESCE(nombre_employes, 0) >= 0 AND COALESCE(emplois_femmes, 0) >= 0
      AND COALESCE(emplois_hommes, 0) >= 0 AND COALESCE(emplois_jeunes, 0) >= 0
      AND COALESCE(emplois_crees, 0) >= 0 AND COALESCE(emplois_maintenus, 0) >= 0
      AND COALESCE(chiffre_affaires, 0) >= 0 AND COALESCE(chiffre_export, 0) >= 0
      AND COALESCE(production_locale, 0) >= 0
    );
  END IF;
END $$;

INSERT INTO permissions (code, description)
VALUES
  ('financing.manage', 'Créer et administrer les financements approuvés'),
  ('disbursement.manage', 'Planifier et confirmer les décaissements'),
  ('repayment.manage', 'Enregistrer les remboursements'),
  ('impact.manage', 'Enregistrer les suivis d’impact')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

WITH mappings(role_code, permission_code) AS (
  VALUES
    ('DIRECTION_FODIP', 'financing.manage'),
    ('DIRECTION_FODIP', 'disbursement.manage'),
    ('DIRECTION_FODIP', 'repayment.manage'),
    ('DIRECTION_FODIP', 'impact.manage'),
    ('DIRECTION_FODIP', 'audit.read'),
    ('SUPER_ADMIN', 'financing.manage'),
    ('SUPER_ADMIN', 'disbursement.manage'),
    ('SUPER_ADMIN', 'repayment.manage'),
    ('SUPER_ADMIN', 'impact.manage')
)
INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM mappings mapping
JOIN roles role ON role.code = mapping.role_code
JOIN permissions permission ON permission.code = mapping.permission_code
ON CONFLICT DO NOTHING;
