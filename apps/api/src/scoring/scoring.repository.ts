import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ScoreResult } from '../scoring-policy';

interface ScoringApplicationRow extends QueryResultRow {
  id: string;
  statut: string;
  agentResponsableId: string | null;
}

export interface ScoringModelRow extends QueryResultRow {
  id: string;
  code: string;
  nom: string;
  version: number;
}

export interface ScoringCriterionRow extends QueryResultRow {
  id: string;
  code: string;
  libelle: string;
  categorie: string | null;
  poids: string;
  scoreMax: string;
  ordreAffichage: number | null;
}

@Injectable()
export class ScoringRepository {
  constructor(private readonly db: DatabaseService) {}

  async findApplication(id: string) {
    const result = await this.db.query<ScoringApplicationRow>(
      `SELECT id, statut, agent_responsable_id AS "agentResponsableId"
       FROM dossiers_financement WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async getActiveModel() {
    const modelResult = await this.db.query<ScoringModelRow>(
      `SELECT id, code, nom, version
       FROM modeles_scoring WHERE actif = TRUE
       ORDER BY version DESC, created_at DESC LIMIT 1`,
    );
    const model = modelResult.rows[0];
    if (!model) return null;
    const criteria = await this.db.query<ScoringCriterionRow>(
      `SELECT id, code, libelle, categorie, poids, score_max AS "scoreMax", ordre_affichage AS "ordreAffichage"
       FROM criteres_scoring
       WHERE modele_id = $1 AND actif = TRUE
       ORDER BY ordre_affichage ASC NULLS LAST, code ASC`,
      [model.id],
    );
    return { ...model, criteres: criteria.rows };
  }

  async getScore(dossierId: string) {
    const scoreResult = await this.db.query(
      `SELECT s.id, s.score_total AS "scoreTotal", s.niveau_risque AS "niveauRisque",
        s.recommandation, s.calcule_at AS "calculeAt", s.valide_par AS "validePar",
        m.code AS "modeleCode", m.nom AS "modeleNom", m.version AS "modeleVersion"
       FROM scores_dossier s
       JOIN modeles_scoring m ON m.id = s.modele_id
       WHERE s.dossier_id = $1
       ORDER BY s.updated_at DESC, s.calcule_at DESC LIMIT 1`,
      [dossierId],
    );
    const score = scoreResult.rows[0];
    if (!score) return null;
    const details = await this.db.query(
      `SELECT c.code, c.libelle, c.categorie, c.poids, c.score_max AS "scoreMax",
        d.score_obtenu AS "scoreObtenu", d.contribution, d.commentaire
       FROM scores_details d
       JOIN criteres_scoring c ON c.id = d.critere_id
       WHERE d.score_dossier_id = $1
       ORDER BY c.ordre_affichage ASC NULLS LAST, c.code ASC`,
      [score.id],
    );
    return { ...score, criteres: details.rows };
  }

  async save(dossierId: string, modeleId: string, userId: string, score: ScoreResult) {
    const details = score.details.map((detail) => ({
      critere_id: detail.critereId,
      score_obtenu: detail.scoreObtenu,
      contribution: detail.contribution,
      commentaire: detail.commentaire || null,
    }));
    await this.db.query(
      `WITH upserted AS (
        INSERT INTO scores_dossier (
          dossier_id, modele_id, score_total, niveau_risque, recommandation,
          calcule_at, valide_par, valide_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, NOW(), NOW())
        ON CONFLICT (dossier_id, modele_id) DO UPDATE SET
          score_total = EXCLUDED.score_total,
          niveau_risque = EXCLUDED.niveau_risque,
          recommandation = EXCLUDED.recommandation,
          calcule_at = NOW(), valide_par = $6, valide_at = NOW(), updated_at = NOW()
        RETURNING id
      ), removed AS (
        DELETE FROM scores_details WHERE score_dossier_id = (SELECT id FROM upserted)
        RETURNING id
      ), inserted AS (
        INSERT INTO scores_details (
          score_dossier_id, critere_id, score_obtenu, contribution, commentaire
        )
        SELECT (SELECT id FROM upserted), x.critere_id, x.score_obtenu, x.contribution, x.commentaire
        FROM jsonb_to_recordset($7::jsonb) AS x(
          critere_id UUID, score_obtenu NUMERIC, contribution NUMERIC, commentaire TEXT
        )
        CROSS JOIN (SELECT COUNT(*) FROM removed) deletion_barrier
      ), audit AS (
        INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, new_values)
        SELECT $6, 'SCORING_CALCULATE', 'DOSSIER_FINANCEMENT', $1,
          jsonb_build_object('scoreTotal', $3, 'niveauRisque', $4, 'recommandation', $5, 'modeleId', $2)
      )
      SELECT id FROM upserted`,
      [dossierId, modeleId, score.scoreTotal, score.niveauRisque, score.recommandation, userId, JSON.stringify(details)],
    );
    return this.getScore(dossierId);
  }
}
