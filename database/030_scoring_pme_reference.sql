-- Institutional reference scoring model.
-- Unlike database/seeds/001_docker_demo.sql, this migration is applied to hosted environments.
-- It is intentionally idempotent and never deactivates a newer scoring model version.

INSERT INTO modeles_scoring (code, nom, version, actif)
VALUES ('SCORING-PME', 'Scoring PME FODIP', 1, TRUE)
ON CONFLICT (code, version) DO UPDATE
SET nom = EXCLUDED.nom,
    actif = TRUE;

WITH modele AS (
  SELECT id
  FROM modeles_scoring
  WHERE code = 'SCORING-PME' AND version = 1
  LIMIT 1
)
INSERT INTO criteres_scoring (
  modele_id, code, libelle, categorie, poids, score_max, ordre_affichage, actif
)
SELECT modele.id, values_set.code, values_set.libelle, values_set.categorie,
       values_set.poids, values_set.score_max, values_set.ordre_affichage, TRUE
FROM modele
CROSS JOIN (
  VALUES
    ('GOUVERNANCE', 'Gouvernance et capacité de gestion', 'ENTREPRISE', 20.00, 100.00, 1),
    ('FINANCE', 'Solidité financière et capacité de remboursement', 'FINANCE', 30.00, 100.00, 2),
    ('VIABILITE', 'Viabilité technique et commerciale du projet', 'PROJET', 30.00, 100.00, 3),
    ('IMPACT', 'Impact attendu sur l’emploi et l’économie locale', 'IMPACT', 20.00, 100.00, 4)
) AS values_set(code, libelle, categorie, poids, score_max, ordre_affichage)
ON CONFLICT (modele_id, code) DO UPDATE
SET libelle = EXCLUDED.libelle,
    categorie = EXCLUDED.categorie,
    poids = EXCLUDED.poids,
    score_max = EXCLUDED.score_max,
    ordre_affichage = EXCLUDED.ordre_affichage,
    actif = TRUE;
