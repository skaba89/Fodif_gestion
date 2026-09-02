-- FODIP Digital 2030
-- TOTP-based multi-factor authentication for accounts flagged mfa_required.

ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS mfa_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS mfa_last_used_step BIGINT;

COMMENT ON COLUMN utilisateurs.mfa_secret_encrypted IS
    'AES-256-GCM encrypted TOTP seed (base64: iv || authTag || ciphertext). NULL until enrollment starts.';
COMMENT ON COLUMN utilisateurs.mfa_confirmed_at IS
    'Set once the user has verified a TOTP code during enrollment. NULL means enrollment is pending or not started.';
COMMENT ON COLUMN utilisateurs.mfa_last_used_step IS
    'Time-step counter of the last accepted TOTP code, used to reject replay of an already-used code.';
