import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ProgramsRepository {
  constructor(private readonly db: DatabaseService) {}

  async listActive() {
    const result = await this.db.query(
      `SELECT
        p.id,
        p.code,
        p.nom,
        p.description,
        COALESCE(rule.montant_min, p.montant_min) AS "montantMin",
        COALESCE(rule.montant_max, p.montant_max) AS "montantMax",
        p.enveloppe_totale AS "enveloppeTotale",
        COALESCE(rule.apport_min_pct, p.apport_min_pct) AS "apportMinPct",
        COALESCE(rule.anciennete_min_mois, p.anciennete_min_mois) AS "ancienneteMinMois",
        COALESCE(rule.rccm_requis, p.rccm_requis) AS "rccmRequis",
        COALESCE(rule.nif_requis, p.nif_requis) AS "nifRequis",
        COALESCE(rule.sla_instruction_jours, p.sla_instruction_jours) AS "slaInstructionJours",
        rule.id AS "regleVersionId",
        rule.version AS "regleVersion",
        p.date_debut AS "dateDebut",
        p.date_fin AS "dateFin",
        CASE
          WHEN rule.id IS NOT NULL THEN COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'code', requirement.code,
                'libelle', requirement.libelle,
                'typeDocument', requirement.type_document,
                'obligatoire', requirement.obligatoire,
                'validiteJours', requirement.validite_jours
              )
              ORDER BY requirement.ordre_affichage ASC, requirement.libelle ASC
            )
            FROM programme_regle_documents requirement
            WHERE requirement.regle_version_id = rule.id
          ), '[]'::jsonb)
          ELSE COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'code', requirement.code,
                'libelle', requirement.libelle,
                'typeDocument', requirement.type_document,
                'obligatoire', requirement.obligatoire,
                'validiteJours', requirement.validite_jours
              )
              ORDER BY requirement.ordre_affichage ASC, requirement.libelle ASC
            )
            FROM programme_documents_requis requirement
            WHERE requirement.programme_id = p.id
              AND requirement.actif = TRUE
          ), '[]'::jsonb)
        END AS "documentsRequis"
      FROM programmes_fodip p
      LEFT JOIN LATERAL (
        SELECT version.*
        FROM programme_regles_versions version
        WHERE version.programme_id = p.id
          AND version.statut = 'ACTIVE'
          AND version.effective_from <= NOW()
          AND (version.effective_to IS NULL OR version.effective_to > NOW())
        ORDER BY version.version DESC
        LIMIT 1
      ) rule ON TRUE
      WHERE p.statut = 'ACTIVE'
        AND (p.date_debut IS NULL OR p.date_debut <= CURRENT_DATE)
        AND (p.date_fin IS NULL OR p.date_fin >= CURRENT_DATE)
      ORDER BY p.nom ASC`,
    );
    return result.rows;
  }
}
