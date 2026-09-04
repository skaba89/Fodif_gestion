-- Sprint Enterprise 0, axe E4 (durcissement OIDC, docs/14-ROADMAP-SAAS-PREMIUM.md) - le jeton de
-- livraison OIDC (OidcService#issueDeliveryToken) est remis au navigateur via une redirection HTTP
-- (?oidc_token=... dans l'URL, oidc.controller.ts) - un canal exposé (historique du navigateur,
-- journaux d'accès serveur/proxy, un poste partagé) - que POST /auth/oidc/exchange échange contre
-- une vraie session ou un défi MFA. Jusqu'ici, seule sa signature et son expiration (2 minutes)
-- étaient vérifiées, sans jamais suivre s'il avait déjà été consommé : quiconque en obtenait une
-- copie pendant sa fenêtre de 2 minutes (historique, journaux...) pouvait appeler /exchange à son
-- tour et obtenir une session à la place de la victime - une vraie fenêtre de rejeu, pas
-- théorique.
--
-- oidc_delivery_tokens_used réclame le `jti` d'un jeton au premier échange réussi (INSERT ... ON
-- CONFLICT DO NOTHING - une deuxième tentative sur le même jti affecte zéro ligne, traitée comme
-- déjà utilisée) - même forme que revoked_tokens (database/017_session_revocation.sql) : une ligne
-- par jti, sa propre expiration copiée du jeton pour qu'une ligne périmée soit inoffensive et
-- purgée à l'occasion plutôt que par une tâche de nettoyage séparée.
CREATE TABLE IF NOT EXISTS oidc_delivery_tokens_used (
    jti UUID PRIMARY KEY,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oidc_delivery_tokens_used_expires_at ON oidc_delivery_tokens_used(expires_at);
