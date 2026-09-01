import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateOwnApplicationDto } from './dto/create-own-application.dto';

@Injectable()
export class ApplicationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async listOwn(userId: string) {
    const result = await this.db.query(
      `SELECT d.id, d.numero_dossier AS "numeroDossier", d.montant_demande AS "montantDemande",
              d.objet_financement AS "objetFinancement", d.statut, d.date_soumission AS "dateSoumission",
              d.created_at AS "createdAt"
       FROM dossiers_financement d
       JOIN utilisateur_entreprises ue ON ue.entreprise_id = d.entreprise_id
       WHERE ue.utilisateur_id = $1
       ORDER BY d.created_at DESC`, [userId]);
    return result.rows;
  }

  async createDraft(userId: string, dto: CreateOwnApplicationDto) {
    const number = `FODIP-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const result = await this.db.query(
      `INSERT INTO dossiers_financement
       (numero_dossier, entreprise_id, programme_id, montant_demande, apport_personnel, objet_financement,
        description_projet, nombre_emplois_prevus, statut)
       SELECT $2, ue.entreprise_id, $3, $4, $5, $6, $7, $8, 'BROUILLON'
       FROM utilisateur_entreprises ue
       WHERE ue.utilisateur_id=$1
       ORDER BY ue.principal DESC, ue.created_at ASC LIMIT 1
       RETURNING id, numero_dossier AS "numeroDossier", statut`,
      [userId, number, dto.programmeId ?? null, dto.montantDemande, dto.apportPersonnel ?? 0,
       dto.objetFinancement, dto.descriptionProjet ?? null, dto.nombreEmploisPrevus ?? 0]);
    return result.rows[0] ?? null;
  }

  async submitOwn(userId: string, applicationId: string) {
    const result = await this.db.query(
      `UPDATE dossiers_financement d
       SET statut='SOUMIS', date_soumission=NOW(), updated_at=NOW()
       WHERE d.id=$2 AND d.statut='BROUILLON'
         AND EXISTS (SELECT 1 FROM utilisateur_entreprises ue WHERE ue.utilisateur_id=$1 AND ue.entreprise_id=d.entreprise_id)
       RETURNING id, numero_dossier AS "numeroDossier", statut, date_soumission AS "dateSoumission"`,
      [userId, applicationId]);
    return result.rows[0] ?? null;
  }
}
