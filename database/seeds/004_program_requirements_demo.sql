-- Demonstration-only programme rules. Never apply seed files to production.

UPDATE programmes_fodip
SET enveloppe_totale = 10000000000,
    apport_min_pct = 10,
    anciennete_min_mois = 6,
    rccm_requis = TRUE,
    nif_requis = TRUE,
    sla_instruction_jours = 15,
    updated_at = NOW()
WHERE code = 'CROISSANCE-PME';

INSERT INTO programme_documents_requis (
    programme_id, code, libelle, type_document, obligatoire, ordre_affichage
)
SELECT p.id, requirement.code, requirement.libelle, requirement.type_document, TRUE, requirement.ordre_affichage
FROM programmes_fodip p
CROSS JOIN (VALUES
    ('RCCM', 'Registre du Commerce et du Crédit Mobilier (RCCM)', 'RCCM', 10),
    ('NIF', 'Numéro d’Identification Fiscale (NIF)', 'NIF', 20),
    ('BUSINESS_PLAN', 'Plan d’affaires / business plan', 'BUSINESS_PLAN', 30)
) AS requirement(code, libelle, type_document, ordre_affichage)
WHERE p.code = 'CROISSANCE-PME'
ON CONFLICT (programme_id, code) DO UPDATE
SET libelle = EXCLUDED.libelle,
    type_document = EXCLUDED.type_document,
    obligatoire = TRUE,
    ordre_affichage = EXCLUDED.ordre_affichage,
    actif = TRUE,
    updated_at = NOW();
