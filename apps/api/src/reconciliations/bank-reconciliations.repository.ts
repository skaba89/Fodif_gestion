import { Injectable } from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CreateBankStatementEntryDto } from './dto/create-bank-statement-entry.dto';
import { ListBankReconciliationsDto } from './dto/list-bank-reconciliations.dto';
import { MatchBankStatementEntryDto } from './dto/match-bank-statement-entry.dto';

interface StatementRow extends QueryResultRow {
  id: string;
  banqueId: string;
  sens: 'DEBIT' | 'CREDIT';
  montant: string;
}

interface OperationRow extends QueryResultRow {
  id: string;
  banqueId: string | null;
  montant: string;
  statut?: string;
}

export type MatchOutcome =
  | { outcome: 'OK'; id: string }
  | { outcome: 'ENTRY_NOT_FOUND' }
  | { outcome: 'ENTRY_ALREADY_MATCHED' }
  | { outcome: 'OPERATION_NOT_FOUND' }
  | { outcome: 'OPERATION_ALREADY_MATCHED' }
  | { outcome: 'OPERATION_NOT_EXECUTED' }
  | { outcome: 'BANK_MISMATCH' }
  | { outcome: 'DIRECTION_MISMATCH' }
  | { outcome: 'AMOUNT_MISMATCH'; statementAmount: number; operationAmount: number };

@Injectable()
export class BankReconciliationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async overview(query: ListBankReconciliationsDto) {
    const offset = (query.page - 1) * query.limite;
    const values = [query.banqueId ?? null, query.statut ?? null, query.limite, offset];
    const [entries, summary, candidates, banks] = await Promise.all([
      this.db.query(
        `SELECT mouvement.id, mouvement.partenaire_bancaire_id AS "banqueId",
          banque.raison_sociale AS "banqueNom", mouvement.reference_externe AS "referenceExterne",
          mouvement.date_operation AS "dateOperation", mouvement.date_valeur AS "dateValeur",
          mouvement.sens, mouvement.montant, mouvement.devise, mouvement.libelle,
          mouvement.lot_import AS "lotImport", mouvement.created_at AS "createdAt",
          CASE WHEN rapprochement.id IS NULL THEN 'A_RAPPROCHER' ELSE 'RAPPROCHE' END AS statut,
          rapprochement.id AS "rapprochementId", rapprochement.rapproche_at AS "rapprocheAt",
          rapprochement.commentaire, rapprochement.decaissement_id AS "decaissementId",
          rapprochement.remboursement_id AS "remboursementId",
          COALESCE(decaissement.montant, remboursement.montant_paye) AS "montantOperation",
          COALESCE(decaissement.reference_bancaire, remboursement.reference_paiement) AS "referenceOperation",
          financement.numero_financement AS "numeroFinancement",
          entreprise.raison_sociale AS "raisonSociale", COUNT(*) OVER()::INT AS total
         FROM mouvements_bancaires mouvement
         JOIN partenaires_bancaires banque ON banque.id = mouvement.partenaire_bancaire_id
         LEFT JOIN rapprochements_bancaires rapprochement ON rapprochement.mouvement_bancaire_id = mouvement.id
         LEFT JOIN decaissements decaissement ON decaissement.id = rapprochement.decaissement_id
         LEFT JOIN remboursements remboursement ON remboursement.id = rapprochement.remboursement_id
         LEFT JOIN financements financement ON financement.id = COALESCE(decaissement.financement_id, remboursement.financement_id)
         LEFT JOIN entreprises entreprise ON entreprise.id = financement.entreprise_id
         WHERE ($1::UUID IS NULL OR mouvement.partenaire_bancaire_id = $1)
           AND ($2::VARCHAR IS NULL OR CASE WHEN rapprochement.id IS NULL THEN 'A_RAPPROCHER' ELSE 'RAPPROCHE' END = $2)
         ORDER BY mouvement.date_operation DESC, mouvement.created_at DESC
         LIMIT $3 OFFSET $4`,
        values,
      ),
      this.db.query(
        `SELECT COUNT(*)::INT AS total,
          COUNT(*) FILTER (WHERE rapprochement.id IS NOT NULL)::INT AS rapproches,
          COUNT(*) FILTER (WHERE rapprochement.id IS NULL)::INT AS "aRapprocher",
          COALESCE(SUM(mouvement.montant) FILTER (WHERE rapprochement.id IS NULL), 0) AS "montantARapprocher"
         FROM mouvements_bancaires mouvement
         LEFT JOIN rapprochements_bancaires rapprochement ON rapprochement.mouvement_bancaire_id = mouvement.id
         WHERE ($1::UUID IS NULL OR mouvement.partenaire_bancaire_id = $1)`,
        [query.banqueId ?? null],
      ),
      this.db.query(
        `SELECT * FROM (
          SELECT decaissement.id, 'DECAISSEMENT'::VARCHAR AS "operationType", 'DEBIT'::VARCHAR AS sens,
            financement.banque_partenaire_id AS "banqueId", banque.raison_sociale AS "banqueNom",
            financement.numero_financement AS "numeroFinancement", entreprise.raison_sociale AS "raisonSociale",
            decaissement.montant, decaissement.date_effective AS "dateOperation",
            decaissement.reference_bancaire AS reference
          FROM decaissements decaissement
          JOIN financements financement ON financement.id = decaissement.financement_id
          JOIN entreprises entreprise ON entreprise.id = financement.entreprise_id
          JOIN partenaires_bancaires banque ON banque.id = financement.banque_partenaire_id
          WHERE decaissement.statut = 'EFFECTUE'
            AND NOT EXISTS (SELECT 1 FROM rapprochements_bancaires r WHERE r.decaissement_id = decaissement.id)
            AND ($1::UUID IS NULL OR financement.banque_partenaire_id = $1)
          UNION ALL
          SELECT remboursement.id, 'REMBOURSEMENT'::VARCHAR AS "operationType", 'CREDIT'::VARCHAR AS sens,
            financement.banque_partenaire_id AS "banqueId", banque.raison_sociale AS "banqueNom",
            financement.numero_financement AS "numeroFinancement", entreprise.raison_sociale AS "raisonSociale",
            remboursement.montant_paye AS montant, remboursement.date_paiement AS "dateOperation",
            remboursement.reference_paiement AS reference
          FROM remboursements remboursement
          JOIN financements financement ON financement.id = remboursement.financement_id
          JOIN entreprises entreprise ON entreprise.id = financement.entreprise_id
          JOIN partenaires_bancaires banque ON banque.id = financement.banque_partenaire_id
          WHERE NOT EXISTS (SELECT 1 FROM rapprochements_bancaires r WHERE r.remboursement_id = remboursement.id)
            AND ($1::UUID IS NULL OR financement.banque_partenaire_id = $1)
        ) candidate
        ORDER BY "dateOperation" DESC
        LIMIT 250`,
        [query.banqueId ?? null],
      ),
      this.db.query(
        `SELECT id, code, raison_sociale AS nom FROM partenaires_bancaires
         WHERE actif = TRUE ORDER BY raison_sociale ASC`,
      ),
    ]);
    const total = Number(entries.rows[0]?.total ?? 0);
    return {
      items: entries.rows.map(({ total: _total, ...entry }) => entry),
      total,
      page: query.page,
      limite: query.limite,
      summary: summary.rows[0],
      candidates: candidates.rows,
      banks: banks.rows,
    };
  }

  async createEntry(userId: string, dto: CreateBankStatementEntryDto) {
    return this.db.transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO mouvements_bancaires (
          partenaire_bancaire_id, reference_externe, date_operation, date_valeur, sens,
          montant, libelle, lot_import, created_by
        ) SELECT banque.id, $2, $3, $4, $5, $6, $7, $8, $9
          FROM partenaires_bancaires banque WHERE banque.id = $1 AND banque.actif = TRUE
        RETURNING id`,
        [dto.banqueId, dto.referenceExterne.trim(), dto.dateOperation, dto.dateValeur ?? null,
          dto.sens, dto.montant, dto.libelle?.trim() || null, dto.lotImport?.trim() || null, userId],
      );
      if (!inserted.rows[0]) return null;
      await this.audit(client, userId, 'CREATE_BANK_STATEMENT_ENTRY', 'MOUVEMENT_BANCAIRE', inserted.rows[0].id, {
        banqueId: dto.banqueId, referenceExterne: dto.referenceExterne.trim(), sens: dto.sens,
        montant: dto.montant, dateOperation: dto.dateOperation,
      });
      return inserted.rows[0].id;
    });
  }

  async matchEntry(userId: string, entryId: string, dto: MatchBankStatementEntryDto): Promise<MatchOutcome> {
    return this.db.transaction(async (client) => {
      const statement = await client.query<StatementRow>(
        `SELECT id, partenaire_bancaire_id AS "banqueId", sens, montant
         FROM mouvements_bancaires WHERE id = $1 FOR UPDATE`,
        [entryId],
      );
      if (!statement.rows[0]) return { outcome: 'ENTRY_NOT_FOUND' };
      const existingEntry = await client.query(
        `SELECT id FROM rapprochements_bancaires WHERE mouvement_bancaire_id = $1`, [entryId],
      );
      if (existingEntry.rows[0]) return { outcome: 'ENTRY_ALREADY_MATCHED' };

      const operation = dto.operationType === 'DECAISSEMENT'
        ? await client.query<OperationRow>(
          `SELECT decaissement.id, decaissement.montant, decaissement.statut,
            financement.banque_partenaire_id AS "banqueId"
           FROM decaissements decaissement
           JOIN financements financement ON financement.id = decaissement.financement_id
           WHERE decaissement.id = $1 FOR UPDATE OF decaissement`,
          [dto.operationId],
        )
        : await client.query<OperationRow>(
          `SELECT remboursement.id, remboursement.montant_paye AS montant,
            financement.banque_partenaire_id AS "banqueId"
           FROM remboursements remboursement
           JOIN financements financement ON financement.id = remboursement.financement_id
           WHERE remboursement.id = $1 FOR UPDATE OF remboursement`,
          [dto.operationId],
        );
      const operationRow = operation.rows[0];
      if (!operationRow) return { outcome: 'OPERATION_NOT_FOUND' };
      if (dto.operationType === 'DECAISSEMENT' && operationRow.statut !== 'EFFECTUE') {
        return { outcome: 'OPERATION_NOT_EXECUTED' };
      }

      const operationColumn = dto.operationType === 'DECAISSEMENT' ? 'decaissement_id' : 'remboursement_id';
      const existingOperation = await client.query(
        `SELECT id FROM rapprochements_bancaires WHERE ${operationColumn} = $1`, [dto.operationId],
      );
      if (existingOperation.rows[0]) return { outcome: 'OPERATION_ALREADY_MATCHED' };

      const statementRow = statement.rows[0];
      if (!operationRow.banqueId || operationRow.banqueId !== statementRow.banqueId) return { outcome: 'BANK_MISMATCH' };
      const expectedDirection = dto.operationType === 'DECAISSEMENT' ? 'DEBIT' : 'CREDIT';
      if (statementRow.sens !== expectedDirection) return { outcome: 'DIRECTION_MISMATCH' };
      if (Number(statementRow.montant) !== Number(operationRow.montant)) {
        return {
          outcome: 'AMOUNT_MISMATCH',
          statementAmount: Number(statementRow.montant),
          operationAmount: Number(operationRow.montant),
        };
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO rapprochements_bancaires (
          mouvement_bancaire_id, decaissement_id, remboursement_id, commentaire, rapproche_par
        ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [entryId, dto.operationType === 'DECAISSEMENT' ? dto.operationId : null,
          dto.operationType === 'REMBOURSEMENT' ? dto.operationId : null,
          dto.commentaire?.trim() || null, userId],
      );
      await this.audit(client, userId, 'RECONCILE_BANK_ENTRY', 'RAPPROCHEMENT_BANCAIRE', inserted.rows[0].id, {
        mouvementBancaireId: entryId, operationType: dto.operationType, operationId: dto.operationId,
        montant: Number(statementRow.montant), banqueId: statementRow.banqueId,
      });
      return { outcome: 'OK', id: inserted.rows[0].id };
    });
  }

  private async audit(client: PoolClient, userId: string, action: string, entityType: string, entityId: string, values: unknown) {
    await client.query(
      `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, entityType, entityId, JSON.stringify(values)],
    );
  }
}
