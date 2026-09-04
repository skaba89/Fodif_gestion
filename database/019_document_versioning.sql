-- Sprint Enterprise 0, axe E6 (gestion documentaire entreprise, docs/14-ROADMAP-SAAS-PREMIUM.md) -
-- versioning des documents. Jusqu'ici, ré-uploader un document du même type pour le même dossier
-- (typiquement : la PME corrige une pièce après un retour "Complément requis" de l'agent) insérait
-- simplement une nouvelle ligne dans dossier_documents sans jamais toucher l'ancienne. L'ancienne
-- ligne restait indéfiniment visible - et surtout actionnable : le tableau de bord de l'agent
-- (agent-applications.repository.ts) affiche tous les documents d'un dossier avec des boutons
-- "Valider"/"Complément" sur chaque ligne, sans distinguer une version périmée d'une version
-- actuelle. Un agent pouvait valider (ou redemander un complément sur) un document que la PME avait
-- déjà remplacé, sans jamais voir la version réellement en attente.
--
-- superseded_by pointe vers le document qui a remplacé celui-ci (NULL tant qu'aucun remplaçant
-- n'existe, c'est-à-dire pour la version actuelle). Rien n'est jamais supprimé ni écrasé - la
-- ligne remplacée reste en base, avec son propre historique de vérification intact, uniquement
-- exclue des vues qui ne doivent montrer que le document actuellement d'actualité
-- (documents.repository.ts#listForReview/verify, agent-applications.repository.ts,
-- committee.repository.ts). listOwned (la PME voit son propre dossier) continue de tout renvoyer,
-- avec ce champ, pour que l'historique reste visible côté PME.
ALTER TABLE dossier_documents ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES dossier_documents(id);

-- Look-up rapide de "la version actuelle de ce type de document dans ce dossier" au moment d'un
-- nouvel upload (documents.repository.ts#create) - un index partiel, puisque seules les lignes non
-- remplacées (superseded_by IS NULL, largement minoritaires une fois l'historique accumulé) sont
-- jamais interrogées de cette façon.
CREATE INDEX IF NOT EXISTS idx_dossier_documents_current
    ON dossier_documents(dossier_id, type_document) WHERE superseded_by IS NULL;
