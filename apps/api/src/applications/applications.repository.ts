import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/create-application.dto';

const APPLICATION_FIELDS: Record<string, string> = {
  programmeId: 'programme_id',
  montantDemande: 'montant_demande',
  apportPersonnel: 'apport_personnel',
  objetFinancement: 'objet_financement',
  descriptionProjet: 'description_projet',
  nombreEmploisPrevus: 'nombre_emplois_prevus',
};

@Injectable()
export class ApplicationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async listByEnterprise(entrepriseId: string) {
    const result = await this.db.query(
      `SELECT
        d.id,
        d.numero_dossier AS "numeroDossier",
        d.entreprise_id AS "entrepriseId",
        d.programme_id AS "programmeId",
        p.nom AS "programmeNom",
        d.montant_demande AS "montantDemande",
        d.apport_personnel AS "apportPersonnel",
        d.objet_financement AS "objetFinancement",
        d.description_projet AS "descriptionProjet",
        d.nombre_emplois_prevus AS "nombreEmploisPrevus",
        d.statut,
        d.date_soumission AS "dateSoumission",
        d.created_at AS "createdAt",
        d.updated_at AS "updatedAt"
      FROM dossiers_financement d
      LEFT JOIN programmes_fodip p ON p.id = d.programme_id
      WHERE d.entreprise_id = $1
      ORDER BY d.created_at DESC`,
      [entrepriseId],
    );
    return result.rows;
  }

  async createDraft(entrepriseId: string, dto: CreateApplicationDto) {
    const result = await this.db.query(
      `INSERT INTO dossiers_financement (
        numero_dossier, entreprise_id, programme_id, montant_demande, apport_personnel,
        objet_financement, description_projet, nombre_emplois_prevus, statut
      ) VALUES (
        CONCAT('FODIP-', EXTRACT(YEAR FROM CURRENT_DATE)::INT, '-', LPAD(nextval('dossier_numero_seq')::TEXT, 6, '0')),
        $1, $2, $3, $4, $5, $6, $7, 'BROUILLON'
      )
      RETURNING id`,
      [
        entrepriseId,
        dto.programmeId,
        dto.montantDemande,
        dto.apportPersonnel ?? 0,
        dto.objetFinancement,
        dto.descriptionProjet ?? null,
        dto.nombreEmploisPrevus ?? 0,
      ],
    );
    return this.findOwnedById(result.rows[0].id, entrepriseId);
  }

  async findOwnedById(id: string, entrepriseId: string) {
    const result = await this.db.query(
      `SELECT
        d.id,
        d.numero_dossier AS "numeroDossier",
        d.entreprise_id AS "entrepriseId",
        d.programme_id AS "programmeId",
        p.nom AS "programmeNom",
        d.montant_demande AS "montantDemande",
        d.apport_personnel AS "apportPersonnel",
        d.objet_financement AS "objetFinancement",
        d.description_projet AS "descriptionProjet",
        d.nombre_emplois_prevus AS "nombreEmploisPrevus",
        d.statut,
        d.date_soumission AS "dateSoumission",
        d.created_at AS "createdAt",
        d.updated_at AS "updatedAt"
      FROM dossiers_financement d
      LEFT JOIN programmes_fodip p ON p.id = d.programme_id
      WHERE d.id = $1 AND d.entreprise_id = $2
      LIMIT 1`,
      [id, entrepriseId],
    );
    return result.rows[0] ?? null;
  }

  async updateOwned(id: string, entrepriseId: string, dto: UpdateApplicationDto) {
    const entries = Object.entries(dto).filter(([key, value]) => APPLICATION_FIELDS[key] && value !== undefined);
    if (entries.length === 0) return this.findOwnedById(id, entrepriseId);

    const values = entries.map(([, value]) => value);
    const setters = entries.map(([key], index) => `${APPLICATION_FIELDS[key]} = $${index + 1}`);
    values.push(id, entrepriseId);

    const result = await this.db.query(
      `UPDATE dossiers_financement
       SET ${setters.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length - 1}
         AND entreprise_id = $${values.length}
         AND statut IN ('BROUILLON', 'COMPLEMENT_REQUIS')
       RETURNING id`,
      values,
    );
    if (!result.rows[0]) return null;
    return this.findOwnedById(id, entrepriseId);
  }

  async submitOwned(id: string, entrepriseId: string, userId: string) {
    const result = await this.db.query(
      `WITH updated AS (
        UPDATE dossiers_financement
        SET statut = 'SOUMIS', date_soumission = NOW(), updated_at = NOW()
        WHERE id = $1 AND entreprise_id = $2 AND statut = 'BROUILLON'
        RETURNING id, entreprise_id
      ), history AS (
        INSERT INTO dossier_statuts_historique (
          dossier_id, ancien_statut, nouveau_statut, commentaire, utilisateur_id
        )
        SELECT id, 'BROUILLON', 'SOUMIS', 'Soumission par la PME', $3
        FROM updated
        RETURNING dossier_id
      )
      SELECT id FROM updated`,
      [id, entrepriseId, userId],
    );
    if (!result.rows[0]) return null;
    return this.findOwnedById(id, entrepriseId);
  }
}
