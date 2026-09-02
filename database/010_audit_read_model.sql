-- FODIP Digital 2030
-- Read model support for the AUDITEUR role's oversight portal: audit_logs was written by every
-- module since 001_initial_schema.sql but never exposed for reading. The existing index on
-- (entity_type, entity_id, created_at DESC) serves "history of one entity"; this one serves the
-- new paginated "most recent activity across the platform" listing (GET /audit/logs).

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
