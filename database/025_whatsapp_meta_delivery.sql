-- Meta WhatsApp delivery status ordering support.
-- Provider webhook timestamps prevent late events from downgrading a newer delivery state.

ALTER TABLE whatsapp_messages
    ADD COLUMN IF NOT EXISTS provider_status_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_provider_status
    ON whatsapp_messages (provider, provider_message_id, provider_status_at DESC)
    WHERE provider_message_id IS NOT NULL;

COMMENT ON COLUMN whatsapp_messages.provider_status_at IS
    'Timestamp supplied by the WhatsApp provider for the latest accepted delivery status event.';
