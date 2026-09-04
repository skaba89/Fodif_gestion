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
-- rate_limit_hits porte l'état partagé qui remplace la Map en mémoire - une LIGNE PAR REQUÊTE
-- comptée (pas un compteur agrégé par clé), pour reproduire fidèlement la fenêtre glissante du
-- stockage en mémoire d'origine plutôt qu'une fenêtre fixe : chaque requête ne compte que pendant
-- `ttl` millisecondes après elle-même, indépendamment des autres. C'est ce que le job CI "Docker
-- Compose, Playwright et audit des images" a trouvé, pas supposé : une première version en fenêtre
-- fixe (un compteur agrégé, remis à zéro seulement à l'expiration de la fenêtre entière) faisait
-- échouer company-profile.spec.ts sur les projets Pixel 7/iPhone 14 - la suite Playwright compte
-- explicitement (voir playwright.config.ts, commentaire HEAVY_LOGIN_SPECS) sur la vraie sémantique
-- glissante du stockage en mémoire pour que des connexions espacées dans le temps ne s'accumulent
-- jamais dans la même fenêtre. Voir postgres-throttler-storage.service.ts pour la logique complète.
--
-- rate_limit_blocks porte l'état "actuellement bloqué" (une ligne par clé bloquée, disparaît une
-- fois le blocage expiré) - séparé de rate_limit_hits parce qu'un blocage est un état par clé, pas
-- par requête individuelle.
CREATE TABLE IF NOT EXISTS rate_limit_hits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(300) NOT NULL,
    throttler_name VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Sert la requête de comptage/nettoyage de postgres-throttler-storage.service.ts (une requête par
-- (clé, throttler) à chaque increment()) et un futur script de purge (même raisonnement que
-- idx_idempotency_keys_created_at, database/015_idempotency_keys.sql) - non livré dans cette PR
-- faute de script existant à étendre (le même suivi que idempotency_keys, jamais construit non
-- plus), sans urgence opérationnelle immédiate : chaque increment() supprime déjà les lignes
-- expirées pour sa propre clé au passage (voir le service), donc la table ne grossit pas au-delà
-- des clés réellement actives.
CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_key ON rate_limit_hits(key, throttler_name, expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_blocks (
    key VARCHAR(300) NOT NULL,
    throttler_name VARCHAR(100) NOT NULL,
    block_expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (key, throttler_name)
);
