-- Sprint Enterprise 0, axe E5 (intégrité financière, docs/14-ROADMAP-SAAS-PREMIUM.md) - contrôle
-- maker-checker (double contrôle à quatre yeux) sur l'exécution des décaissements : la personne
-- qui exécute un décaissement (executed_by, l'argent sort réellement) ne peut jamais être la même
-- que celle qui l'a planifié (created_by, déjà en place depuis 007_financing_operations.sql) - une
-- seule personne ne peut jamais, seule, faire sortir de l'argent du début à la fin.
--
-- Ne s'applique qu'au flux Direction (planifier puis exécuter, financings.repository.ts) : le
-- décaissement déclaré par un partenaire bancaire (partner.repository.ts#createDisbursement) est
-- inséré directement en statut EFFECTUE, sans étape de planification distincte - il rapporte un
-- paiement déjà effectué par une tierce partie externe (la banque elle-même), pas une décision
-- interne à deux étapes ; executed_by y reste NULL par construction, ce que la contrainte
-- ci-dessous tolère explicitement.
ALTER TABLE decaissements ADD COLUMN IF NOT EXISTS executed_by UUID REFERENCES utilisateurs(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_decaissements_maker_checker') THEN
    ALTER TABLE decaissements ADD CONSTRAINT ck_decaissements_maker_checker
      CHECK (executed_by IS NULL OR created_by IS NULL OR executed_by <> created_by);
  END IF;
END $$;
