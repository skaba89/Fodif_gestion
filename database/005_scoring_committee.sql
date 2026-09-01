-- Step 10: versioned scoring details and auditable committee decisions.

CREATE TABLE IF NOT EXISTS scores_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score_dossier_id UUID NOT NULL REFERENCES scores_dossier(id) ON DELETE CASCADE,
    critere_id UUID NOT NULL REFERENCES criteres_scoring(id),
    score_obtenu NUMERIC(10,2) NOT NULL CHECK (score_obtenu >= 0),
    contribution NUMERIC(10,4) NOT NULL CHECK (contribution >= 0),
    commentaire TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (score_dossier_id, critere_id)
);

ALTER TABLE scores_dossier
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE decisions_comite
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES utilisateurs(id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scores_dossier_modele
    ON scores_dossier(dossier_id, modele_id);

CREATE INDEX IF NOT EXISTS idx_scores_details_score
    ON scores_details(score_dossier_id, critere_id);

CREATE INDEX IF NOT EXISTS idx_decisions_comite_dossier_date
    ON decisions_comite(dossier_id, date_decision DESC);

INSERT INTO permissions (code, description)
VALUES ('scoring.calculate', 'Calculer et enregistrer le scoring d’un dossier affecté')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'scoring.calculate'
WHERE r.code IN ('AGENT_FODIP', 'SUPER_ADMIN')
ON CONFLICT DO NOTHING;
