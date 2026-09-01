import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ProgramsRepository {
  constructor(private readonly db: DatabaseService) {}

  async listActive() {
    const result = await this.db.query(
      `SELECT
        id,
        code,
        nom,
        description,
        montant_min AS "montantMin",
        montant_max AS "montantMax",
        date_debut AS "dateDebut",
        date_fin AS "dateFin"
      FROM programmes_fodip
      WHERE statut = 'ACTIVE'
        AND (date_debut IS NULL OR date_debut <= CURRENT_DATE)
        AND (date_fin IS NULL OR date_fin >= CURRENT_DATE)
      ORDER BY nom ASC`,
    );
    return result.rows;
  }
}
