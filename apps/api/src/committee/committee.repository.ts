import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { CommitteeDecisionDto } from './dto/committee-decision.dto';
import { ListCommitteeApplicationsDto } from './dto/list-committee-applications.dto';
import { DatabaseService } from '../database/database.service';

interface CommitteeApplicationRow extends QueryResultRow {
  id: string;
  statut: string;
  montantDemande: string;
}

@Injectable()
export class CommitteeRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(query: ListCommitteeApplicationsDto) {
    const offset = (query.page - 1) * query.limite;
    const result = await this.db.query(
      `SELECT d.id, d.numero_dossier AS "numeroDossier", d.montant_demande AS "montantDemande",
        d.statut, d.date_soumission AS "dateSoumission", e.raison_sociale AS "raisonSociale",
        e.code_fodip AS "codeFodip", p.nom AS "programmeNom",
        s.score_total AS "scoreTotal", s.niveau_risque AS "niveauRisque", s.recommandation,
        COUNT(*) OVER()::INT AS "total"
       FROM dossiers_financement d
       JOIN entreprises e ON e.id = d.entreprise_id
       LEFT JOIN programmes_fodip p ON p.id = d.programme_id
       LEFT JOIN LATERAL (
         SELECT score_total, niveau_risque, recommandation
         FROM scores_dossier WHERE dossier_id = d.id ORDER BY updated_at DESC, calcule_at DESC LIMIT 1
       ) s ON TRUE
       WHERE d.statut = 'PRET_COMITE'
       ORDER BY d.updated_at ASC
       LIMIT $1 OFFSET $2`,
      [query.limite, offset],
    );
    const total = Number(result.rows[0]?.total ?? 0);
    const items = result.rows.map(({ total: _total, ...item }) => item);
    return { items, total, page: query.page, limite: query.limite };
  }

  async findById(id: string) {
    const applicationResult = await this.db.query<CommitteeApplicationRow>(
      `SELECT d.id, d.numero_dossier AS "numeroDossier", d.montant_demande AS "montantDemande",
        d.apport_personnel AS "apportPersonnel", d.objet_financement AS "objetFinancement",
        d.description_projet AS "descriptionProjet", d.nombre_emplois_prevus AS "nombreEmploisPrevus",
        d.statut, d.date_soumission AS "dateSoumission", e.raison_sociale AS "raisonSociale",
        e.code_fodip AS "codeFodip", e.rccm, e.nif, e.nombre_employes AS "nombreEmployes",
        e.chiffre_affaires_annuel AS "chiffreAffairesAnnuel", p.nom AS "programmeNom"
       FROM dossiers_financement d
       JOIN entreprises e ON e.id = d.entreprise_id
       LEFT JOIN programmes_fodip p ON p.id = d.programme_id
       WHERE d.id = $1 LIMIT 1`,
      [id],
    );
    const application = applicationResult.rows[0];
    if (!application) return null;

    const [scoreResult, documents, decisions] = await Promise.all([
      this.db.query(
        `SELECT s.id, s.score_total AS "scoreTotal", s.niveau_risque AS "niveauRisque",
          s.recommandation, s.calcule_at AS "calculeAt", m.nom AS "modeleNom", m.version AS "modeleVersion"
         FROM scores_dossier s JOIN modeles_scoring m ON m.id = s.modele_id
         WHERE s.dossier_id = $1 ORDER BY s.updated_at DESC, s.calcule_at DESC LIMIT 1`,
        [id],
      ),
      this.db.query(
        // Axe E6 (versioning, docs/14-ROADMAP-SAAS-PREMIUM.md) - only the current version, same
        // reasoning as agent-applications.repository.ts's identical query.
        `SELECT id, type_document AS "typeDocument", nom_fichier AS "nomFichier",
          statut_verification AS "statutVerification"
         FROM dossier_documents WHERE dossier_id = $1 AND superseded_by IS NULL ORDER BY created_at DESC`,
        [id],
      ),
      this.db.query(
        `SELECT decision, montant_approuve AS "montantApprouve", taux_interet AS "tauxInteret",
          duree_mois AS "dureeMois", commentaire, date_decision AS "dateDecision"
         FROM decisions_comite WHERE dossier_id = $1 ORDER BY date_decision DESC`,
        [id],
      ),
    ]);

    const score = scoreResult.rows[0] ?? null;
    const scoreDetails = score ? await this.db.query(
      `SELECT c.code, c.libelle, c.categorie, c.poids, c.score_max AS "scoreMax",
        d.score_obtenu AS "scoreObtenu", d.contribution, d.commentaire
       FROM scores_details d JOIN criteres_scoring c ON c.id = d.critere_id
       WHERE d.score_dossier_id = $1 ORDER BY c.ordre_affichage ASC NULLS LAST, c.code ASC`,
      [score.id],
    ) : null;

    return {
      ...application,
      score: score ? { ...score, criteres: scoreDetails?.rows ?? [] } : null,
      documents: documents.rows,
      decisions: decisions.rows,
    };
  }

  async decide(id: string, userId: string, dto: CommitteeDecisionDto) {
    const result = await this.db.query(
      `WITH updated AS (
        UPDATE dossiers_financement
        SET statut = $3, updated_at = NOW()
        WHERE id = $1 AND statut = 'PRET_COMITE'
        RETURNING id
      ), decision AS (
        INSERT INTO decisions_comite (
          dossier_id, decision, montant_approuve, taux_interet, duree_mois, differe_mois,
          garanties, conditions, commentaire, date_decision, created_by
        )
        SELECT id, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $2 FROM updated
      ), history AS (
        INSERT INTO dossier_statuts_historique (
          dossier_id, ancien_statut, nouveau_statut, commentaire, utilisateur_id
        ) SELECT id, 'PRET_COMITE', $3, COALESCE($10, 'Décision du comité'), $2 FROM updated
      ), audit AS (
        INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, old_values, new_values)
        SELECT $2, 'COMMITTEE_DECISION', 'DOSSIER_FINANCEMENT', id,
          jsonb_build_object('statut', 'PRET_COMITE'),
          jsonb_build_object('statut', $3, 'montantApprouve', $4, 'dureeMois', $6)
        FROM updated
      )
      SELECT id FROM updated`,
      [
        id, userId, dto.decision, dto.montantApprouve ?? null, dto.tauxInteret ?? null,
        dto.dureeMois ?? null, dto.differeMois ?? 0, dto.garanties?.trim() || null,
        dto.conditions?.trim() || null, dto.commentaire?.trim() || null,
      ],
    );
    return result.rows[0] ?? null;
  }
}
