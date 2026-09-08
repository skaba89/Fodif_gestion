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
        p.montant_min AS "montantMin",
        p.montant_max AS "montantMax",
        p.enveloppe_totale AS "enveloppeTotale",
        p.apport_min_pct AS "apportMinPct",
        p.anciennete_min_mois AS "ancienneteMinMois",
        p.rccm_requis AS "rccmRequis",
        p.nif_requis AS "nifRequis",
        p.sla_instruction_jours AS "slaInstructionJours",
        p.date_debut AS "dateDebut",
        p.date_fin AS "dateFin",
        COALESCE((
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
        ), '[]'::jsonb) AS "documentsRequis"
      FROM programmes_fodip p
      WHERE p.statut = 'ACTIVE'
        AND (p.date_debut IS NULL OR p.date_debut <= CURRENT_DATE)
        AND (p.date_fin IS NULL OR p.date_fin >= CURRENT_DATE)
      ORDER BY p.nom ASC`,
    );
    return result.rows;
  }
}
