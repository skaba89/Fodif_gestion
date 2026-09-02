-- FODIP Digital 2030
-- Axe B5 (docs/14-ROADMAP-SAAS-PREMIUM.md) - encryption at rest for sensitive personal data beyond
-- the password hash (B1) and the MFA TOTP seed (B2, database/009_mfa_totp.sql) already encrypted.
-- utilisateurs.telephone is the one such field with a live write path (administration.repository.ts
-- create() - there is no update path for it, and no other table column holding personal data of a
-- named individual has a write path at all: entreprise_dirigeants is currently read-only from the
-- API, and entreprises.telephone/email/adresse are a legal entity's business contact details, not
-- an individual's - out of scope here). Widened rather than left at VARCHAR(50): an AES-256-GCM
-- ciphertext (12-byte IV + 16-byte auth tag + ciphertext, base64-encoded - see
-- apps/api/src/security-policy.js#encryptWithKey, already used for the MFA seed) is always longer
-- than the plaintext phone number it replaces.
ALTER TABLE utilisateurs ALTER COLUMN telephone TYPE VARCHAR(255);

COMMENT ON COLUMN utilisateurs.telephone IS
    'AES-256-GCM ciphertext (base64), not plaintext - see AdministrationRepository/DataRightsRepository and security-policy.js#encryptWithKey. NULL means none was provided.';
