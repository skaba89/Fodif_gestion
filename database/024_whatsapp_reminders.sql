-- Idempotent WhatsApp reminder engine.
-- A reminder occurrence is unique per rule, user, business object and scheduled date.

CREATE TABLE IF NOT EXISTS whatsapp_reminder_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key VARCHAR(80) NOT NULL,
    utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    context_type VARCHAR(50) NOT NULL,
    context_id UUID NOT NULL,
    scheduled_for DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CLAIMED',
    attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
    whatsapp_message_id UUID REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
    last_error_code VARCHAR(100),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_whatsapp_reminder_dispatch_status
        CHECK (status IN ('CLAIMED', 'SENT', 'FAILED')),
    CONSTRAINT uq_whatsapp_reminder_occurrence
        UNIQUE (rule_key, utilisateur_id, context_type, context_id, scheduled_for)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_reminder_dispatch_retry
    ON whatsapp_reminder_dispatches (status, last_attempt_at)
    WHERE status = 'FAILED';

CREATE INDEX IF NOT EXISTS idx_whatsapp_reminder_dispatch_user
    ON whatsapp_reminder_dispatches (utilisateur_id, scheduled_for DESC);

INSERT INTO permissions (code, description)
VALUES ('communications.reminders.run', 'Déclencher le traitement contrôlé des relances WhatsApp')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.code = 'communications.reminders.run'
WHERE role.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

COMMENT ON TABLE whatsapp_reminder_dispatches IS
    'Idempotency and retry ledger for WhatsApp reminder occurrences; no message body or template variables are persisted.';
