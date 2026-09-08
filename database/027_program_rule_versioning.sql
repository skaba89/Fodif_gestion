-- FODIP Digital 2030
-- Versioned programme rules and immutable dossier snapshots.
-- Additive only: no existing programme rule is removed and no submitted dossier is re-evaluated.

CREATE TABLE IF NOT EXISTS programme_regles_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id UUID NOT NULL REFERENCES programmes_fodip(id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version > 0),
    statut VARCHAR(20) NOT NULL DEFAULT 'BROUILLON'
        CHECK (statut IN ('BROUILLON', 'ACTIVE', 'ARCHIVEE')),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    montant_min NUMERIC(20,2) CHECK (montant_min IS NULL OR montant_min > 0),
    montant_max NUMERIC(20,2) CHECK (montant_max IS NULL OR montant_max > 0),
    apport_min_pct NUMERIC(5,2)
        CHECK (apport_min_pct IS NULL OR (apport_min_pct >= 0 AND apport_min_pct <= 100)),
    anciennete_min_mois INTEGER
        CHECK (anciennete_min_mois IS NULL OR anciennete_min_mois >= 0),
    rccm_requis BOOLEAN NOT NULL DEFAULT FALSE,
    nif_requis BOOLEAN NOT NULL DEFAULT FALSE,
    sla_instruction_jours INTEGER
        CHECK (sla_instruction_jours IS NULL OR sla_instruction_jours > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_programme_regle_version UNIQUE (programme_id, version),
    CONSTRAINT ck_programme_regle_montants CHECK (
        montant_min IS NULL OR montant_max IS NULL OR montant_min <= montant_max
    ),
    CONSTRAINT ck_programme_regle_effectivity CHECK (
        effective_to IS NULL OR effective_to > effective_from
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_programme_regle_active
    ON programme_regles_versions(programme_id)
    WHERE statut = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_programme_regles_programme_version
    ON programme_regles_versions(programme_id, version DESC);

CREATE TABLE IF NOT EXISTS programme_regle_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regle_version_id UUID NOT NULL REFERENCES programme_regles_versions(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    libelle VARCHAR(255) NOT NULL,
    type_document VARCHAR(100) NOT NULL,
    obligatoire BOOLEAN NOT NULL DEFAULT TRUE,
    validite_jours INTEGER CHECK (validite_jours IS NULL OR validite_jours > 0),
    ordre_affichage INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_programme_regle_document_code UNIQUE (regle_version_id, code),
    CONSTRAINT uq_programme_regle_document_type UNIQUE (regle_version_id, type_document),
    CONSTRAINT ck_programme_regle_document_type CHECK (
        type_document IN ('RCCM', 'NIF', 'BUSINESS_PLAN', 'ETATS_FINANCIERS', 'GARANTIE', 'AUTRE')
    )
);

CREATE INDEX IF NOT EXISTS idx_programme_regle_documents_version
    ON programme_regle_documents(regle_version_id, ordre_affichage, libelle);

ALTER TABLE dossiers_financement
    ADD COLUMN IF NOT EXISTS programme_regle_version_id UUID
        REFERENCES programme_regles_versions(id);

CREATE INDEX IF NOT EXISTS idx_dossiers_programme_regle_version
    ON dossiers_financement(programme_regle_version_id)
    WHERE programme_regle_version_id IS NOT NULL;

-- Snapshot the currently configured programme rules as version 1. If this SQL is replayed in an
-- environment where another active version already exists, version 1 is created archived instead
-- of violating the one-active-version invariant.
INSERT INTO programme_regles_versions (
    programme_id,
    version,
    statut,
    effective_from,
    montant_min,
    montant_max,
    apport_min_pct,
    anciennete_min_mois,
    rccm_requis,
    nif_requis,
    sla_instruction_jours
)
SELECT
    p.id,
    1,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM programme_regles_versions existing
            WHERE existing.programme_id = p.id
              AND existing.statut = 'ACTIVE'
        ) THEN 'ARCHIVEE'
        ELSE 'ACTIVE'
    END,
    COALESCE(p.created_at, NOW()),
    p.montant_min,
    p.montant_max,
    p.apport_min_pct,
    p.anciennete_min_mois,
    p.rccm_requis,
    p.nif_requis,
    p.sla_instruction_jours
FROM programmes_fodip p
ON CONFLICT (programme_id, version) DO NOTHING;

-- Only requirements active at migration time belong to the historical baseline.
INSERT INTO programme_regle_documents (
    regle_version_id,
    code,
    libelle,
    type_document,
    obligatoire,
    validite_jours,
    ordre_affichage
)
SELECT
    version.id,
    requirement.code,
    requirement.libelle,
    requirement.type_document,
    requirement.obligatoire,
    requirement.validite_jours,
    requirement.ordre_affichage
FROM programme_documents_requis requirement
JOIN programme_regles_versions version
  ON version.programme_id = requirement.programme_id
 AND version.version = 1
WHERE requirement.actif = TRUE
ON CONFLICT (regle_version_id, type_document) DO NOTHING;

-- Dossiers which have already left BROUILLON must keep the rules that were in force before this
-- versioning capability existed. Drafts intentionally remain unlocked and will capture the active
-- version only on their first submission.
UPDATE dossiers_financement dossier
SET programme_regle_version_id = version.id
FROM programme_regles_versions version
WHERE dossier.programme_id = version.programme_id
  AND version.version = 1
  AND dossier.programme_regle_version_id IS NULL
  AND dossier.statut <> 'BROUILLON';

-- Once a version is referenced by a dossier, its substantive criteria become immutable. Lifecycle
-- metadata (statut/effective_to/updated_at) may still change so a newer version can be activated.
CREATE OR REPLACE FUNCTION prevent_referenced_programme_rule_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM dossiers_financement dossier
        WHERE dossier.programme_regle_version_id = OLD.id
    ) AND (
        NEW.programme_id IS DISTINCT FROM OLD.programme_id OR
        NEW.version IS DISTINCT FROM OLD.version OR
        NEW.effective_from IS DISTINCT FROM OLD.effective_from OR
        NEW.montant_min IS DISTINCT FROM OLD.montant_min OR
        NEW.montant_max IS DISTINCT FROM OLD.montant_max OR
        NEW.apport_min_pct IS DISTINCT FROM OLD.apport_min_pct OR
        NEW.anciennete_min_mois IS DISTINCT FROM OLD.anciennete_min_mois OR
        NEW.rccm_requis IS DISTINCT FROM OLD.rccm_requis OR
        NEW.nif_requis IS DISTINCT FROM OLD.nif_requis OR
        NEW.sla_instruction_jours IS DISTINCT FROM OLD.sla_instruction_jours
    ) THEN
        RAISE EXCEPTION 'Referenced programme rule version cannot be modified';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_referenced_programme_rule_mutation
    ON programme_regles_versions;
CREATE TRIGGER trg_prevent_referenced_programme_rule_mutation
BEFORE UPDATE ON programme_regles_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_referenced_programme_rule_mutation();

-- A checklist is part of the rule snapshot. Adding, changing or deleting a requirement after a
-- dossier references that version would silently rewrite history, so PostgreSQL blocks it.
CREATE OR REPLACE FUNCTION prevent_referenced_programme_rule_document_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_version_id UUID;
BEGIN
    target_version_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.regle_version_id ELSE NEW.regle_version_id END;

    IF EXISTS (
        SELECT 1
        FROM dossiers_financement dossier
        WHERE dossier.programme_regle_version_id = target_version_id
    ) THEN
        RAISE EXCEPTION 'Referenced programme rule checklist cannot be modified';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_referenced_programme_rule_document_mutation
    ON programme_regle_documents;
CREATE TRIGGER trg_prevent_referenced_programme_rule_document_mutation
BEFORE INSERT OR UPDATE OR DELETE ON programme_regle_documents
FOR EACH ROW
EXECUTE FUNCTION prevent_referenced_programme_rule_document_mutation();
