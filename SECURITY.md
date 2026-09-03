# Politique de sécurité

FODIP Digital 2030 est une plateforme institutionnelle traitant des données personnelles et
financières de PME guinéennes. Nous prenons au sérieux tout signalement de vulnérabilité.

## Signaler une vulnérabilité

**Ne pas ouvrir d'issue publique pour une vulnérabilité de sécurité.** Un dépôt public expose
immédiatement le problème à quiconque le lit avant qu'un correctif existe.

Utilisez plutôt l'un de ces canaux, dans l'ordre de préférence :

1. **GitHub Security Advisories** (privé) : onglet *Security* → *Report a vulnerability* de ce
   dépôt, si activé pour ce dépôt.
2. **Contact direct** avec le propriétaire du dépôt ([@skaba89](https://github.com/skaba89)), via
   un canal privé GitHub (message direct, ou une issue marquée confidentielle si l'option ci-dessus
   n'est pas disponible).

Merci d'inclure :

- une description du problème et de son impact potentiel ;
- les étapes pour le reproduire (ou un exploit de démonstration a minima) ;
- la version ou le commit concerné ;
- votre évaluation de la sévérité, si vous en avez une (CVSS ou simplement critique/haute/
  moyenne/basse).

## Ce qu'il ne faut jamais transmettre par ce canal

Aucune donnée personnelle réelle d'une PME, aucun jeton de session valide, aucun secret réel de
production. Si le signalement nécessite une preuve d'exploitation, utilisez les comptes de
démonstration documentés (`docker-compose.yml`, `database/seeds/`) plutôt que des données réelles.

## Délai de réponse visé

- Accusé de réception : sous 3 jours ouvrés.
- Première évaluation (sévérité, plan de correction) : sous 7 jours ouvrés.
- Correctif pour une vulnérabilité critique ou haute : traité en priorité, sans délai fixe garanti
  compte tenu de la taille de l'équipe actuelle - mais jamais silencieusement ignoré.

## Divulgation coordonnée

Nous demandons un délai raisonnable pour corriger avant toute divulgation publique. Nous
créditerons volontiers la personne ayant signalé le problème dans les notes de correctif, sauf
préférence contraire de sa part.

## Versions couvertes

Ce dépôt n'a pas encore de version stable publiée (`docs/14-ROADMAP-SAAS-PREMIUM.md`, axe B7b :
l'hébergement institutionnel définitif reste à choisir). Seule la branche `main` est couverte par
cette politique.

## Ce que fait déjà la plateforme

Pour référence, avant même un signalement externe : authentification JWT + MFA TOTP imposé pour
les rôles sensibles, RBAC fin avec isolation par PME, chiffrement au repos des données
personnelles sensibles, `helmet`, limitation de débit, journal d'audit complet, dépendances
scannées en continu (voir `.github/workflows/`). Le détail complet est dans
`docs/14-ROADMAP-SAAS-PREMIUM.md` (phase B).
