-- Step 13: persistent in-app notifications and secured user administration.

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    type VARCHAR(80) NOT NULL,
    titre VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    lien VARCHAR(500),
    entity_type VARCHAR(100),
    entity_id UUID,
    deduplication_key VARCHAR(300),
    lu_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notification_deduplication UNIQUE (utilisateur_id, deduplication_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(utilisateur_id, created_at DESC)
    WHERE lu_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(utilisateur_id, created_at DESC);

INSERT INTO permissions (code, description)
VALUES
    ('notification.read', 'Lire et acquitter ses propres notifications'),
    ('user.manage', 'Créer, activer, désactiver et affecter les rôles utilisateurs'),
    ('role.read', 'Lire le référentiel des rôles et permissions')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'notification.read'
WHERE r.code <> 'PARTENAIRE_BANCAIRE'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION notify_enterprise_users(
    target_enterprise UUID,
    event_type VARCHAR,
    event_title VARCHAR,
    event_message TEXT,
    event_link VARCHAR,
    event_entity_type VARCHAR,
    event_entity_id UUID,
    event_key VARCHAR
) RETURNS VOID AS $$
BEGIN
    INSERT INTO notifications (
        utilisateur_id, type, titre, message, lien, entity_type, entity_id, deduplication_key
    )
    SELECT relation.utilisateur_id, event_type, event_title, event_message, event_link,
           event_entity_type, event_entity_id, event_key
    FROM utilisateur_entreprises relation
    JOIN utilisateurs utilisateur ON utilisateur.id = relation.utilisateur_id AND utilisateur.actif = TRUE
    WHERE relation.entreprise_id = target_enterprise
    ON CONFLICT (utilisateur_id, deduplication_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_role_users(
    target_role VARCHAR,
    event_type VARCHAR,
    event_title VARCHAR,
    event_message TEXT,
    event_link VARCHAR,
    event_entity_type VARCHAR,
    event_entity_id UUID,
    event_key VARCHAR
) RETURNS VOID AS $$
BEGIN
    INSERT INTO notifications (
        utilisateur_id, type, titre, message, lien, entity_type, entity_id, deduplication_key
    )
    SELECT DISTINCT utilisateur.id, event_type, event_title, event_message, event_link,
           event_entity_type, event_entity_id, event_key
    FROM utilisateurs utilisateur
    JOIN utilisateur_roles utilisateur_role ON utilisateur_role.utilisateur_id = utilisateur.id
    JOIN roles role ON role.id = utilisateur_role.role_id
    WHERE role.code = target_role AND utilisateur.actif = TRUE
    ON CONFLICT (utilisateur_id, deduplication_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION dossier_notification_trigger() RETURNS TRIGGER AS $$
DECLARE
    event_key VARCHAR;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
        RETURN NEW;
    END IF;

    event_key := 'DOSSIER:' || NEW.id || ':' || NEW.statut;

    IF NEW.statut = 'SOUMIS' THEN
        PERFORM notify_role_users(
            'AGENT_FODIP', 'DOSSIER_SOUMIS', 'Nouveau dossier soumis',
            'Le dossier ' || NEW.numero_dossier || ' attend une prise en charge.',
            '/agent/dossiers/' || NEW.id, 'DOSSIER_FINANCEMENT', NEW.id, event_key
        );
    ELSIF NEW.statut = 'PRET_COMITE' THEN
        PERFORM notify_role_users(
            'COMITE_FINANCEMENT', 'DOSSIER_PRET_COMITE', 'Dossier prêt pour le comité',
            'Le dossier ' || NEW.numero_dossier || ' est prêt pour décision.',
            '/comite/dossiers/' || NEW.id, 'DOSSIER_FINANCEMENT', NEW.id, event_key
        );
    END IF;

    IF NEW.statut IN ('COMPLEMENT_REQUIS', 'PRET_COMITE', 'APPROUVE', 'REJETE', 'ANNULE') THEN
        PERFORM notify_enterprise_users(
            NEW.entreprise_id, 'DOSSIER_' || NEW.statut,
            CASE NEW.statut
                WHEN 'COMPLEMENT_REQUIS' THEN 'Complément requis'
                WHEN 'PRET_COMITE' THEN 'Dossier transmis au comité'
                WHEN 'APPROUVE' THEN 'Financement approuvé'
                WHEN 'REJETE' THEN 'Décision sur votre dossier'
                ELSE 'Dossier annulé'
            END,
            'Le statut du dossier ' || NEW.numero_dossier || ' est maintenant « ' || NEW.statut || ' ».',
            '/entrepreneur/suivi', 'DOSSIER_FINANCEMENT', NEW.id, event_key
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dossier_notifications ON dossiers_financement;
CREATE TRIGGER trg_dossier_notifications
AFTER INSERT OR UPDATE OF statut ON dossiers_financement
FOR EACH ROW EXECUTE FUNCTION dossier_notification_trigger();

CREATE OR REPLACE FUNCTION disbursement_notification_trigger() RETURNS TRIGGER AS $$
DECLARE
    target_enterprise UUID;
BEGIN
    SELECT entreprise_id
    INTO target_enterprise
    FROM financements WHERE id = NEW.financement_id;

    IF NEW.statut = 'EFFECTUE' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM NEW.statut) THEN
        PERFORM notify_enterprise_users(
            target_enterprise, 'DECAISSEMENT_EFFECTUE', 'Décaissement effectué',
            'Un décaissement de ' || TO_CHAR(NEW.montant, 'FM999G999G999G999G990') || ' GNF a été effectué.',
            '/entrepreneur/suivi', 'DECAISSEMENT', NEW.id,
            'DECAISSEMENT:' || NEW.id || ':EFFECTUE'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION repayment_notification_trigger() RETURNS TRIGGER AS $$
DECLARE
    target_enterprise UUID;
BEGIN
    SELECT entreprise_id INTO target_enterprise
    FROM financements WHERE id = NEW.financement_id;

    PERFORM notify_enterprise_users(
        target_enterprise, 'REMBOURSEMENT_ENREGISTRE', 'Remboursement enregistré',
        'Votre paiement de ' || TO_CHAR(NEW.montant_paye, 'FM999G999G999G999G990') || ' GNF a été enregistré.',
        '/entrepreneur/suivi', 'REMBOURSEMENT', NEW.id,
        'REMBOURSEMENT:' || NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_disbursement_notifications ON decaissements;
CREATE TRIGGER trg_disbursement_notifications
AFTER INSERT OR UPDATE OF statut ON decaissements
FOR EACH ROW EXECUTE FUNCTION disbursement_notification_trigger();

DROP TRIGGER IF EXISTS trg_repayment_notifications ON remboursements;
CREATE TRIGGER trg_repayment_notifications
AFTER INSERT ON remboursements
FOR EACH ROW EXECUTE FUNCTION repayment_notification_trigger();
