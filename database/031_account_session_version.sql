-- Institutional session invalidation.
-- A JWT contains the account's session_version at issuance time. Any authorization-sensitive
-- administrative operation increments the database value, causing every older token to be
-- rejected immediately by JwtAuthGuard.
ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_utilisateurs_session_version_positive'
  ) THEN
    ALTER TABLE utilisateurs
      ADD CONSTRAINT chk_utilisateurs_session_version_positive CHECK (session_version > 0);
  END IF;
END
$$;

COMMENT ON COLUMN utilisateurs.session_version IS
  'Incremented to invalidate every previously issued access token for this account.';
