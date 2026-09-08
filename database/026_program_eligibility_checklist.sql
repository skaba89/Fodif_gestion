-- FODIP Digital 2030
-- Programme eligibility metadata + per-programme documentary checklist.
-- Additive only: existing programmes and dossiers keep their current behaviour until rules are configured.

ALTER TABLE programmes_fodip
    ADD COLUMN IF NOT EXISTS enveloppe_totale NUMERIC(20,2)
        CHECK (enveloppe_totale IS NULL OR enveloppe_totale > 0),
    ADD COLUMN IF NOT EXISTS apport_min_pct NUMERIC(5,2)
        CHECK (apport_min_pct IS NULL OR (apport_min_pct >= 0 AND apport_min_pct <= 100)),
    ADD COLUMN IF NOT EXISTS anciennete_min_mois INTEGER
        CHECK (anciennete_min_mois IS NULL OR anciennete_min_mois >= 0),
    ADD COLUMN IF NOT EXISTS rccm_requis BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS nif_requis BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sla_instruction_jours INTEGER
        CHECK (sla_instruction_jours IS NULL OR sla_instruction_jours > 0);

CREATE TABLE IF NOT EXISTS programme_documents_requis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id UUID NOT NULL REFERENCES programmes_fodip(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    libelle VARCHAR(255) NOT NULL,
    type_document VARCHAR(100) NOT NULL,
    obligatoire BOOLEAN NOT NULL DEFAULT TRUE,
    validite_jours INTEGER CHECK (validite_jours IS NULL OR validite_jours > 0),
    ordre_affichage INTEGER NOT NULL DEFAULT 0,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_programme_document_code UNIQUE (programme_id, code),
    CONSTRAINT uq_programme_document_type UNIQUE (programme_id, type_document),
    CONSTRAINT ck_programme_document_type CHECK (
        type_document IN ('RCCM', 'NIF', 'BUSINESS_PLAN', 'ETATS_FINANCIERS', 'GARANTIE', 'AUTRE')
    )
);

CREATE INDEX IF NOT EXISTS idx_programme_documents_requis_active
    ON programme_documents_requis(programme_id, ordre_affichage, libelle)
    WHERE actif = TRUE;
