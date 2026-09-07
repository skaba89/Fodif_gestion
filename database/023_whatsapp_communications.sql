-- WhatsApp communication foundation
-- Additive migration: consent/preferences and delivery audit without storing message bodies.

CREATE TABLE IF NOT EXISTS whatsapp_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utilisateur_id UUID NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
    telephone_e164 VARCHAR(20) NOT NULL,
    consent_status VARCHAR(20) NOT NULL DEFAULT 'OPTED_OUT',
    consent_source VARCHAR(50),
    consented_at TIMESTAMPTZ,
    opted_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_whatsapp_preferences_phone
        CHECK (telephone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT ck_whatsapp_preferences_status
        CHECK (consent_status IN ('OPTED_IN', 'OPTED_OUT')),
    CONSTRAINT ck_whatsapp_preferences_consent_dates
        CHECK (
            (consent_status = 'OPTED_IN' AND consented_at IS NOT NULL AND opted_out_at IS NULL)
            OR
            (consent_status = 'OPTED_OUT')
        )
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_preferences_status
    ON whatsapp_preferences (consent_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    preference_id UUID REFERENCES whatsapp_preferences(id) ON DELETE SET NULL,
    direction VARCHAR(20) NOT NULL,
    message_type VARCHAR(30) NOT NULL,
    template_key VARCHAR(120),
    status VARCHAR(20) NOT NULL,
    provider VARCHAR(80),
    provider_message_id VARCHAR(255),
    recipient_fingerprint CHAR(64),
    context_type VARCHAR(50),
    context_id UUID,
    error_code VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    CONSTRAINT ck_whatsapp_messages_direction
        CHECK (direction IN ('OUTBOUND', 'INBOUND')),
    CONSTRAINT ck_whatsapp_messages_type
        CHECK (message_type IN ('REMINDER', 'SUPPORT', 'CHATBOT', 'TRANSACTIONAL')),
    CONSTRAINT ck_whatsapp_messages_status
        CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED')),
    CONSTRAINT ck_whatsapp_messages_fingerprint
        CHECK (recipient_fingerprint IS NULL OR recipient_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_messages_provider_message
    ON whatsapp_messages (provider, provider_message_id)
    WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_created
    ON whatsapp_messages (utilisateur_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status_created
    ON whatsapp_messages (status, created_at DESC);

COMMENT ON TABLE whatsapp_preferences IS
    'Per-user WhatsApp opt-in/opt-out state bound to an explicit E.164 phone number.';
COMMENT ON TABLE whatsapp_messages IS
    'Operational WhatsApp delivery audit. Message bodies and template variables are intentionally not persisted.';
