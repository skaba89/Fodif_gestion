import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ListAgentApplicationsDto } from './dto/list-agent-applications.dto';

interface AgentApplicationDetailRow extends QueryResultRow {
  id: string;
  entrepriseId: string;
  statut: string;
  agentResponsableId: string | null;
}

@Injectable()
export class AgentApplicationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(query: ListAgentApplicationsDto) {
    const offset = (query.page - 1) * query.limite;
    const result = await this.db.query(
      `SELECT
        d.id,
        d.numero_dossier AS "numeroDossier",
        d.montant_demande AS "montantDemande",
        d.statut,
        d.date_soumission AS "dateSoumission",
        d.agent_responsable_id AS "agentResponsableId",
        e.id AS "entrepriseId",
        e.raison_sociale AS "raisonSociale",
        e.code_fodip AS "codeFodip",
        p.nom AS "programmeNom",
        COUNT(*) OVER()::INT AS "total"
      FROM dossiers_financement d
      JOIN entreprises e ON e.id = d.entreprise_id
      LEFT JOIN programmes_fodip p ON p.id = d.programme_id
      WHERE d.statut IN ('SOUMIS', 'EN_INSTRUCTION', 'COMPLEMENT_REQUIS', 'PRET_COMITE')
        AND ($1::VARCHAR IS NULL OR d.statut = $1)
        AND ($2::VARCHAR IS NULL OR
          d.numero_dossier ILIKE '%' || $2 || '%' OR
          e.raison_sociale ILIKE '%' || $2 || '%' OR
          e.code_fodip ILIKE '%' || $2 || '%')
      ORDER BY
        CASE d.statut WHEN 'SOUMIS' THEN 1 WHEN 'COMPLEMENT_REQUIS' THEN 2 WHEN 'EN_INSTRUCTION' THEN 3 ELSE 4 END,
        d.date_soumission ASC NULLS LAST
      LIMIT $3 OFFSET $4`,
      [query.statut ?? null, query.recherche?.trim() || null, query.limite, offset],
    );
    const total = Number(result.rows[0]?.total ?? 0);
    const items = result.rows.map(({ total: _total, ...item }) => item);
    return { items, total, page: query.page, limite: query.limite };
  }

  async findById(id: string) {
    const dossierResult = await this.db.query<AgentApplicationDetailRow>(
      `SELECT
        d.id,
        d.numero_dossier AS "numeroDossier",
        d.entreprise_id AS "entrepriseId",
        d.programme_id AS "programmeId",
        d.montant_demande AS "montantDemande",
        d.apport_personnel AS "apportPersonnel",
        d.objet_financement AS "objetFinancement",
        d.description_projet AS "descriptionProjet",
        d.nombre_emplois_prevus AS "nombreEmploisPrevus",
        d.statut,
        d.date_soumission AS "dateSoumission",
        d.agent_responsable_id AS "agentResponsableId",
        d.created_at AS "createdAt",
        e.code_fodip AS "codeFodip",
        e.raison_sociale AS "raisonSociale",
        e.nom_commercial AS "nomCommercial",
        e.rccm,
        e.nif,
        e.forme_juridique AS "formeJuridique",
        e.nombre_employes AS "nombreEmployes",
        e.chiffre_affaires_annuel AS "chiffreAffairesAnnuel",
        e.telephone,
        e.email,
        e.adresse,
        p.nom AS "programmeNom"
      FROM dossiers_financement d
      JOIN entreprises e ON e.id = d.entreprise_id
      LEFT JOIN programmes_fodip p ON p.id = d.programme_id
      WHERE d.id = $1
      LIMIT 1`,
      [id],
    );
    const dossier = dossierResult.rows[0];
    if (!dossier) return null;

    const [dirigeants, documents, historique, scores] = await Promise.all([
      this.db.query(
        `SELECT id, nom, prenom, fonction, telephone, email, genre,
          dirigeant_principal AS "dirigeantPrincipal"
         FROM entreprise_dirigeants WHERE entreprise_id = $1
         ORDER BY dirigeant_principal DESC, created_at ASC`,
        [dossier.entrepriseId],
      ),
      this.db.query(
        `SELECT id, type_document AS "typeDocument", nom_fichier AS "nomFichier",
          mime_type AS "mimeType", taille_octets AS "tailleOctets",
          statut_verification AS "statutVerification",
          verification_comment AS "verificationComment", created_at AS "createdAt"
         FROM dossier_documents WHERE dossier_id = $1 ORDER BY created_at DESC`,
        [id],
      ),
      this.db.query(
        `SELECT ancien_statut AS "ancienStatut", nouveau_statut AS "nouveauStatut",
          commentaire, utilisateur_id AS "utilisateurId", changed_at AS "changedAt"
         FROM dossier_statuts_historique WHERE dossier_id = $1 ORDER BY changed_at DESC`,
        [id],
      ),
      this.db.query(
        `SELECT score_total AS "scoreTotal", niveau_risque AS "niveauRisque",
          recommandation, calcule_at AS "calculeAt"
         FROM scores_dossier WHERE dossier_id = $1 ORDER BY calcule_at DESC`,
        [id],
      ),
    ]);

    return { ...dossier, dirigeants: dirigeants.rows, documents: documents.rows, historique: historique.rows, scores: scores.rows };
  }

  async claim(id: string, userId: string) {
    const result = await this.db.query(
      `WITH candidate AS (
        SELECT id, statut AS old_status
        FROM dossiers_financement
        WHERE id = $1
          AND statut IN ('SOUMIS', 'EN_INSTRUCTION', 'COMPLEMENT_REQUIS')
          AND (agent_responsable_id IS NULL OR agent_responsable_id = $2)
        FOR UPDATE
      ), updated AS (
        UPDATE dossiers_financement d
        SET agent_responsable_id = $2,
            statut = CASE WHEN candidate.old_status = 'SOUMIS' THEN 'EN_INSTRUCTION' ELSE candidate.old_status END,
            updated_at = NOW()
        FROM candidate
        WHERE d.id = candidate.id
        RETURNING d.id, candidate.old_status, d.statut
      ), history AS (
        INSERT INTO dossier_statuts_historique (
          dossier_id, ancien_statut, nouveau_statut, commentaire, utilisateur_id
        )
        SELECT id, old_status, statut, 'Prise en charge par un agent FODIP', $2
        FROM updated WHERE old_status <> statut
      ), audit AS (
        INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, new_values)
        SELECT $2, 'APPLICATION_CLAIM', 'DOSSIER_FINANCEMENT', id,
          jsonb_build_object('agentResponsableId', $2, 'statut', statut)
        FROM updated
      )
      SELECT id FROM updated`,
      [id, userId],
    );
    return result.rows[0] ?? null;
  }

  async transition(id: string, userId: string, expectedStatus: string, nextStatus: string, commentaire: string) {
    const result = await this.db.query(
      `WITH updated AS (
        UPDATE dossiers_financement
        SET statut = $4, updated_at = NOW()
        WHERE id = $1 AND agent_responsable_id = $2 AND statut = $3
        RETURNING id
      ), history AS (
        INSERT INTO dossier_statuts_historique (
          dossier_id, ancien_statut, nouveau_statut, commentaire, utilisateur_id
        ) SELECT id, $3, $4, $5, $2 FROM updated
      ), audit AS (
        INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, old_values, new_values)
        SELECT $2, 'APPLICATION_REVIEW', 'DOSSIER_FINANCEMENT', id,
          jsonb_build_object('statut', $3), jsonb_build_object('statut', $4, 'commentaire', $5)
        FROM updated
      )
      SELECT id FROM updated`,
      [id, userId, expectedStatus, nextStatus, commentaire],
    );
    return result.rows[0] ?? null;
  }
}
