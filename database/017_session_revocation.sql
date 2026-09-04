-- Sprint Enterprise 0, axe E4 (identité et sécurité entreprise, docs/14-ROADMAP-SAAS-PREMIUM.md) -
-- révocation de session. Jusqu'ici, "Déconnexion" (apps/web/app/api/session/logout/route.ts)
-- n'effaçait que le cookie du navigateur : le jeton JWT lui-même restait valide côté API jusqu'à
-- son expiration naturelle (JWT_ACCESS_TTL, 15 minutes par défaut) - un jeton volé ou une session
-- laissée ouverte sur un poste partagé restait utilisable après une déconnexion explicite.
--
-- revoked_tokens porte une entrée par jeton révoqué (identifié par sa réclamation JWT `jti`,
-- ajoutée à l'émission - voir session-token.service.ts), avec sa propre date d'expiration copiée
-- du jeton lui-même : passé ce délai le jeton ne serait plus accepté de toute façon (sa propre
-- signature JWT expire), donc la ligne devient inutile - purgée par RevocationService à chaque
-- nouvelle révocation plutôt que par une tâche planifiée séparée (voir revocation.service.ts).
CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti UUID PRIMARY KEY,
    utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id),
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);
