-- Sprint Enterprise 0, axe E5 - rapprochement bancaire.
--
-- Les mouvements issus des relevés bancaires restent séparés des opérations internes : un
-- décaissement/remboursement déclaré dans FODIP n'est considéré comme rapproché qu'après qu'un
-- agent habilité l'a associé à la ligne bancaire correspondante. Cette migration est additive et
-- ne change ni les montants ni les statuts des opérations financières existantes.

CREATE TABLE IF NOT EXISTS mouvements_bancaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partenaire_bancaire_id UUID NOT NULL REFERENCES partenaires_bancaires(id),
    reference_externe VARCHAR(255) NOT NULL,
    date_operation DATE NOT NULL,
    date_valeur DATE,
    sens VARCHAR(10) NOT NULL CHECK (sens IN ('DEBIT', 'CREDIT')),
    montant NUMERIC(20,2) NOT NULL CHECK (montant > 0),
    devise CHAR(3) NOT NULL DEFAULT 'GNF' CHECK (devise = 'GNF'),
    libelle TEXT,
    lot_import VARCHAR(100),
    created_by UUID NOT NULL REFERENCES utilisateurs(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mouvements_bancaires_reference
      UNIQUE (partenaire_bancaire_id, reference_externe)
);

CREATE TABLE IF NOT EXISTS rapprochements_bancaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mouvement_bancaire_id UUID NOT NULL UNIQUE REFERENCES mouvements_bancaires(id),
    decaissement_id UUID UNIQUE REFERENCES decaissements(id),
    remboursement_id UUID UNIQUE REFERENCES remboursements(id),
    commentaire TEXT,
    rapproche_par UUID NOT NULL REFERENCES utilisateurs(id),
    rapproche_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_rapprochements_operation_unique CHECK (
      num_nonnulls(decaissement_id, remboursement_id) = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_mouvements_bancaires_date
    ON mouvements_bancaires(partenaire_bancaire_id, date_operation DESC);
CREATE INDEX IF NOT EXISTS idx_rapprochements_bancaires_date
    ON rapprochements_bancaires(rapproche_at DESC);

INSERT INTO permissions (code, description)
VALUES
  ('reconciliation.read', 'Lire les mouvements et rapprochements bancaires'),
  ('reconciliation.manage', 'Enregistrer et rapprocher les mouvements bancaires')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

WITH mappings(role_code, permission_code) AS (
  VALUES
    ('DIRECTION_FODIP', 'reconciliation.read'),
    ('DIRECTION_FODIP', 'reconciliation.manage'),
    ('ANALYSTE', 'reconciliation.read'),
    ('AUDITEUR', 'reconciliation.read'),
    ('SUPER_ADMIN', 'reconciliation.read'),
    ('SUPER_ADMIN', 'reconciliation.manage')
)
INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM mappings mapping
JOIN roles role ON role.code = mapping.role_code
JOIN permissions permission ON permission.code = mapping.permission_code
ON CONFLICT DO NOTHING;
