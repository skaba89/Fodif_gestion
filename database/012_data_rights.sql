-- FODIP Digital 2030
-- Axe B6 (docs/14-ROADMAP-SAAS-PREMIUM.md) - "droits des personnes" half: export and erasure on
-- request. The other half of B6 (a scheduled, retention-duration-based automatic purge) is
-- deliberately NOT built here: how long each category of record must be kept (financial records,
-- audit trail...) is a legal fact specific to Guinean law, not an engineering choice, and
-- inventing a number would be worse than leaving it explicitly open pending that decision.

ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

COMMENT ON COLUMN utilisateurs.anonymized_at IS
    'Set once an erasure request has been processed for this account (see data-rights module): nom/prenom/telephone/email are overwritten with a non-identifying placeholder and the account is deactivated. NULL means no such request has been processed.';
