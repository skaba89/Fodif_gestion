-- FODIP Digital 2030
-- Axe D1 - minimal data model for institutional bank partners. Product decision (see
-- docs/14-ROADMAP-SAAS-PREMIUM.md, axe D1): a partner's visible scope is the union of two
-- independent, deliberately simple mechanisms rather than one all-or-nothing link -
--   1. correspondent bank: a financing can designate a partner bank responsible for actually
--      executing its disbursements/repayments on FODIP's behalf and reporting them back
--      (financements.banque_partenaire_id) - FODIP keeps the financing decision, the bank
--      executes and self-reports;
--   2. client portfolio: a partner can also be granted visibility over a roster of PME clients
--      (partenaire_entreprises) it already has a commercial relationship with, independently of
--      which bank happens to be executing payment on any one of their financings.
-- Partner accounts authenticate exactly like every other account (email/password + JWT, see
-- auth/session-token.service.ts) - no separate API-key subsystem, matching how the platform has
-- no machine-to-machine auth surface today and building one is a security-sensitive project of
-- its own, not a side effect of wiring up one role.

CREATE TABLE IF NOT EXISTS partenaires_bancaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    raison_sociale VARCHAR(255) NOT NULL,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One partner bank per account, mirroring the existing PME pattern (utilisateur_entreprises)
-- closely enough in spirit but kept as a single nullable column rather than a junction table:
-- unlike a PME user (which can in principle be linked to more than one enterprise relation), a
-- bank partner account represents exactly one institution.
ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS partenaire_bancaire_id UUID REFERENCES partenaires_bancaires(id);

ALTER TABLE financements
    ADD COLUMN IF NOT EXISTS banque_partenaire_id UUID REFERENCES partenaires_bancaires(id);

CREATE TABLE IF NOT EXISTS partenaire_entreprises (
    partenaire_id UUID NOT NULL REFERENCES partenaires_bancaires(id) ON DELETE CASCADE,
    entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (partenaire_id, entreprise_id)
);

CREATE INDEX IF NOT EXISTS idx_utilisateurs_partenaire_bancaire ON utilisateurs(partenaire_bancaire_id);
CREATE INDEX IF NOT EXISTS idx_financements_banque_partenaire ON financements(banque_partenaire_id);
CREATE INDEX IF NOT EXISTS idx_partenaire_entreprises_entreprise ON partenaire_entreprises(entreprise_id);
