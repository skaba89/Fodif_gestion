-- Sprint Enterprise 0, axe E4 (identité et sécurité entreprise, docs/14-ROADMAP-SAAS-PREMIUM.md) -
-- rate limiting distribué. Jusqu'ici, ThrottlerModule utilisait le stockage en mémoire fourni par
-- défaut par @nestjs/throttler (une Map en process) : chaque instance de l'API compte les requêtes
-- pour son propre compte, sans jamais voir ce que les autres instances ont déjà compté. Avec deux
-- instances ou plus derrière un même load balancer (le déploiement cible pour la production, non
-- représenté par la stack de démo Docker Compose à une seule instance de ce dépôt), un attaquant
-- réparti sur les deux le fait échouer intégralement : une limite de 300 requêtes/minute devient en
-- pratique 300 x N instances, et sur /auth/login (protégé par un @Throttle() plus strict, voir
-- auth.controller.ts) la protection contre le bourrage d'identifiants ne tient plus du tout dès
-- qu'un attaquant distribue ses tentatives sur plusieurs instances.
--
-- rate_limit_hits porte l'état partagé qui remplace la Map en mémoire - une ligne par (clé de
-- throttling, nom du throttler @nestjs/throttler, ex. "default" ou une route @Throttle()
-- spécifique). Voir postgres-throttler-storage.service.ts pour la logique de fenêtre glissante et
-- de blocage qui lit/écrit cette table.
CREATE TABLE IF NOT EXISTS rate_limit_hits (
    key VARCHAR(300) NOT NULL,
    throttler_name VARCHAR(100) NOT NULL,
    total_hits INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    block_expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key, throttler_name)
);

-- Sert un futur script de purge (même raisonnement que idx_idempotency_keys_created_at,
-- database/015_idempotency_keys.sql) : une ligne n'a besoin de vivre que tant que sa fenêtre ou son
-- blocage est actif, jamais indéfiniment. Purge non livrée dans cette PR faute de script existant à
-- étendre (le même suivi que idempotency_keys, jamais construit non plus) - la table reste petite
-- en pratique (une ligne par identifiant réellement actif, expirée en quelques minutes au plus),
-- donc sans urgence opérationnelle immédiate.
CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_expires_at ON rate_limit_hits(expires_at);
