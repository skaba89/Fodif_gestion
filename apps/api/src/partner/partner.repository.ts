import { Injectable } from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CreatePartnerDisbursementDto } from './dto/create-partner-disbursement.dto';
import { ListPartnerFinancingsDto } from './dto/list-partner-financings.dto';
import { CreateRepaymentDto } from '../financings/dto/create-repayment.dto';

// A partner's scope is the union of two independent mechanisms (see database/011_partner_banks.sql):
// financings where it is the designated correspondent bank, plus financings belonging to any PME
// in its client portfolio. Kept as one SQL fragment so list/detail/mutations can never drift apart.
const PARTNER_SCOPE = `(financement.banque_partenaire_id = $1
  OR financement.entreprise_id IN (SELECT entreprise_id FROM partenaire_entreprises WHERE partenaire_id = $1))`;

interface PaymentContextRow extends QueryResultRow {
  montantTotalDu: string;
  montantPaye: string;
}

@Injectable()
export class PartnerRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(partnerId: string, query: ListPartnerFinancingsDto) {
    const offset = (query.page - 1) * query.limite;
    const search = query.search?.trim() || null;
    const result = await this.db.query(
      `SELECT financement.id, financement.numero_financement AS "numeroFinancement",
        financement.dossier_id AS "dossierId", dossier.numero_dossier AS "numeroDossier",
        financement.entreprise_id AS "entrepriseId", entreprise.raison_sociale AS "raisonSociale",
        financement.montant_accorde AS "montantAccorde", financement.taux_interet AS "tauxInteret",
        financement.duree_mois AS "dureeMois", financement.date_debut AS "dateDebut",
        financement.date_fin_prevue AS "dateFinPrevue", financement.statut,
        COUNT(*) OVER()::INT AS "total"
       FROM financements financement
       JOIN dossiers_financement dossier ON dossier.id = financement.dossier_id
       JOIN entreprises entreprise ON entreprise.id = financement.entreprise_id
       WHERE ${PARTNER_SCOPE}
         AND ($4::text IS NULL OR financement.numero_financement ILIKE '%' || $4 || '%'
              OR dossier.numero_dossier ILIKE '%' || $4 || '%' OR entreprise.raison_sociale ILIKE '%' || $4 || '%')
         AND ($5::date IS NULL OR financement.date_debut >= $5)
         AND ($6::date IS NULL OR financement.date_debut <= $6)
       ORDER BY financement.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [partnerId, query.limite, offset, search, query.dateFrom ?? null, query.dateTo ?? null],
    );
    const total = Number(result.rows[0]?.total ?? 0);
    const items = result.rows.map(({ total: _total, ...item }) => item);
    return { items, total, page: query.page, limite: query.limite };
  }

  /**
   * Full-scope aggregates for the partner's dashboard (issue #142: "tableau de bord partenaire").
   * Unlike the page-scoped KPIs computed client-side on `list()`'s current page, this always
   * covers the whole PARTNER_SCOPE regardless of pagination, so the numbers don't silently change
   * with the number of items per page.
   */
  async dashboard(partnerId: string) {
    // Reuses analytics.vw_financing_performance (database/006_analytics_read_model.sql) - one
    // pre-aggregated row per financement (montant_decaisse/montant_du/montant_rembourse/impaye) -
    // rather than re-deriving the same totals with ad hoc joins, so a partner's dashboard numbers
    // never drift from how Direction's own cockpit computes the identical metrics.
    const totals = await this.db.query<{
      financements: string; montantAccorde: string; montantDecaisse: string; montantRembourse: string; impayes: string;
    }>(
      `SELECT COUNT(*)::text AS financements,
        COALESCE(SUM(performance.montant_accorde), 0) AS "montantAccorde",
        COALESCE(SUM(performance.montant_decaisse), 0) AS "montantDecaisse",
        COALESCE(SUM(performance.montant_rembourse), 0) AS "montantRembourse",
        COALESCE(SUM(performance.impaye), 0) AS impayes
       FROM analytics.vw_financing_performance performance
       JOIN financements financement ON financement.id = performance.financement_id
       WHERE ${PARTNER_SCOPE}`,
      [partnerId],
    );
    const upcoming = await this.db.query<{
      id: string; numeroEcheance: number; dateEcheance: string; resteAPayer: string;
      numeroFinancement: string; raisonSociale: string;
    }>(
      `SELECT echeance.id, echeance.numero_echeance AS "numeroEcheance", echeance.date_echeance AS "dateEcheance",
        GREATEST(echeance.montant_total_du - COALESCE(SUM(remboursement.montant_paye), 0), 0) AS "resteAPayer",
        financement.id AS "financementId", financement.numero_financement AS "numeroFinancement",
        entreprise.raison_sociale AS "raisonSociale"
       FROM echeances echeance
       JOIN financements financement ON financement.id = echeance.financement_id
       JOIN entreprises entreprise ON entreprise.id = financement.entreprise_id
       LEFT JOIN remboursements remboursement ON remboursement.echeance_id = echeance.id
       WHERE ${PARTNER_SCOPE} AND echeance.statut <> 'PAYEE' AND echeance.date_echeance >= CURRENT_DATE
       GROUP BY echeance.id, financement.id, entreprise.raison_sociale
       HAVING GREATEST(echeance.montant_total_du - COALESCE(SUM(remboursement.montant_paye), 0), 0) > 0
       ORDER BY echeance.date_echeance ASC
       LIMIT 10`,
      [partnerId],
    );
    return { ...totals.rows[0], echeancesAVenir: upcoming.rows };
  }

  /**
   * "Historique des opérations du partenaire" (issue #142): every decaissement/remboursement this
   * partner has itself declared through this API (PARTNER_DECLARE_DISBURSEMENT/
   * PARTNER_DECLARE_REPAYMENT - see #audit in createDisbursement/createRepayment above, which is
   * the only place these two actions are ever written). Filtered on the `partenaireId` recorded at
   * declaration time, not on the financing's *current* PARTNER_SCOPE - a financing later
   * reassigned to a different correspondent bank must not erase this partner's own history of what
   * it actually declared while it still held that financing.
   */
  async operations(partnerId: string, query: ListPartnerFinancingsDto) {
    const offset = (query.page - 1) * query.limite;
    const result = await this.db.query(
      `SELECT log.id, log.action, log.entity_type AS "entityType", log.entity_id AS "entityId",
        log.new_values AS "newValues", log.created_at AS "createdAt",
        financement.id AS "financementId", financement.numero_financement AS "numeroFinancement",
        entreprise.raison_sociale AS "raisonSociale",
        COUNT(*) OVER()::INT AS "total"
       FROM audit_logs log
       JOIN financements financement ON financement.id::text = log.new_values->>'financementId'
       JOIN entreprises entreprise ON entreprise.id = financement.entreprise_id
       WHERE log.action IN ('PARTNER_DECLARE_DISBURSEMENT', 'PARTNER_DECLARE_REPAYMENT')
         AND log.new_values->>'partenaireId' = $1::text
       ORDER BY log.created_at DESC
       LIMIT $2 OFFSET $3`,
      [partnerId, query.limite, offset],
    );
    const total = Number(result.rows[0]?.total ?? 0);
    const items = result.rows.map(({ total: _total, ...item }) => item);
    return { items, total, page: query.page, limite: query.limite };
  }

  /**
   * Scoped detail read. Deliberately omits `impact` (FODIP-internal reporting) and `audit`
   * (FODIP staff identities) - both are out of a bank partner's business, unlike the full
   * FinancingDetail an internal role (Direction, AUDITEUR) reads via FinancingsRepository#findById.
   */
  async findById(partnerId: string, financingId: string) {
    const base = await this.db.query(
      `SELECT financement.id, financement.numero_financement AS "numeroFinancement",
        financement.dossier_id AS "dossierId", dossier.numero_dossier AS "numeroDossier",
        financement.entreprise_id AS "entrepriseId", entreprise.raison_sociale AS "raisonSociale",
        financement.montant_accorde AS "montantAccorde", financement.taux_interet AS "tauxInteret",
        financement.duree_mois AS "dureeMois", financement.date_signature AS "dateSignature",
        financement.date_debut AS "dateDebut", financement.date_fin_prevue AS "dateFinPrevue", financement.statut
       FROM financements financement
       JOIN dossiers_financement dossier ON dossier.id = financement.dossier_id
       JOIN entreprises entreprise ON entreprise.id = financement.entreprise_id
       WHERE financement.id = $2 AND ${PARTNER_SCOPE}
       LIMIT 1`,
      [partnerId, financingId],
    );
    if (!base.rows[0]) return null;
    const [disbursements, installments] = await Promise.all([
      this.db.query(
        `SELECT id, numero_decaissement AS "numeroDecaissement", montant, date_prevue AS "datePrevue",
          date_effective AS "dateEffective", reference_bancaire AS "referenceBancaire", statut, created_at AS "createdAt"
         FROM decaissements WHERE financement_id = $1 ORDER BY numero_decaissement ASC`, [financingId],
      ),
      this.db.query(
        `SELECT echeance.id, echeance.numero_echeance AS "numeroEcheance", echeance.date_echeance AS "dateEcheance",
          echeance.capital_du AS "capitalDu", echeance.interet_du AS "interetDu",
          echeance.montant_total_du AS "montantTotalDu", echeance.statut,
          COALESCE(SUM(remboursement.montant_paye), 0) AS "montantPaye",
          GREATEST(echeance.montant_total_du - COALESCE(SUM(remboursement.montant_paye), 0), 0) AS "resteAPayer"
         FROM echeances echeance
         LEFT JOIN remboursements remboursement ON remboursement.echeance_id = echeance.id
         WHERE echeance.financement_id = $1
         GROUP BY echeance.id ORDER BY echeance.numero_echeance ASC`, [financingId],
      ),
    ]);
    return { ...base.rows[0], disbursements: disbursements.rows, installments: installments.rows };
  }

  /** Records a payment the partner already made - inserted directly as EFFECTUE, no PREVU step. */
  async createDisbursement(partnerId: string, financingId: string, userId: string, dto: CreatePartnerDisbursementDto) {
    return this.db.transaction(async (client) => {
      const locked = await client.query<{ montantAccorde: string }>(
        `SELECT financement.montant_accorde AS "montantAccorde"
         FROM financements financement
         WHERE financement.id = $2 AND financement.statut = 'ACTIF' AND ${PARTNER_SCOPE}
         FOR UPDATE OF financement`,
        [partnerId, financingId],
      );
      if (!locked.rows[0]) return null;
      const totals = await client.query<{ committed: string; nextNumber: number }>(
        `SELECT COALESCE(SUM(montant) FILTER (WHERE statut <> 'ANNULE'), 0) AS committed,
          COALESCE(MAX(numero_decaissement), 0) + 1 AS "nextNumber"
         FROM decaissements WHERE financement_id = $1`, [financingId],
      );
      if (Number(totals.rows[0].committed) + dto.montant > Number(locked.rows[0].montantAccorde) + 0.001) return null;
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO decaissements (
          financement_id, numero_decaissement, montant, date_prevue, date_effective, reference_bancaire, statut, created_by
        ) VALUES ($1, $2, $3, $4, $4, $5, 'EFFECTUE', $6) RETURNING id`,
        [financingId, totals.rows[0].nextNumber, dto.montant, dto.dateEffective, dto.referenceBancaire.trim(), userId],
      );
      await this.audit(client, userId, 'PARTNER_DECLARE_DISBURSEMENT', 'DECAISSEMENT', inserted.rows[0].id, null, {
        financementId: financingId, partenaireId: partnerId, montant: dto.montant, numero: totals.rows[0].nextNumber,
      });
      return inserted.rows[0];
    });
  }

  /** Records a repayment the partner already collected on FODIP's behalf. */
  async createRepayment(partnerId: string, financingId: string, userId: string, dto: CreateRepaymentDto) {
    return this.db.transaction(async (client) => {
      const inScope = await client.query(
        `SELECT financement.id FROM financements financement WHERE financement.id = $2 AND ${PARTNER_SCOPE} FOR UPDATE OF financement`,
        [partnerId, financingId],
      );
      if (!inScope.rows[0]) return null;
      const locked = await client.query<{ montantTotalDu: string }>(
        `SELECT montant_total_du AS "montantTotalDu" FROM echeances
         WHERE id = $2 AND financement_id = $1 FOR UPDATE`,
        [financingId, dto.echeanceId],
      );
      if (!locked.rows[0]) return null;
      const paid = await client.query<{ montantPaye: string }>(
        `SELECT COALESCE(SUM(montant_paye), 0) AS "montantPaye"
         FROM remboursements WHERE echeance_id = $1`, [dto.echeanceId],
      );
      const row: PaymentContextRow = { ...locked.rows[0], montantPaye: paid.rows[0].montantPaye };
      if (Number(row.montantPaye) + dto.montant > Number(row.montantTotalDu) + 0.001) return null;
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO remboursements (
          financement_id, echeance_id, montant_paye, date_paiement, reference_paiement, moyen_paiement, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [financingId, dto.echeanceId, dto.montant, dto.datePaiement,
          dto.referencePaiement?.trim() || null, dto.moyenPaiement ?? 'AUTRE', userId],
      );
      const paidAfter = Number(row.montantPaye) + dto.montant;
      await client.query(
        `UPDATE echeances SET statut = CASE WHEN $2 >= montant_total_du THEN 'PAYEE' ELSE 'PARTIELLEMENT_PAYEE' END
         WHERE id = $1`,
        [dto.echeanceId, paidAfter],
      );
      await this.audit(client, userId, 'PARTNER_DECLARE_REPAYMENT', 'REMBOURSEMENT', inserted.rows[0].id, null, {
        financementId: financingId, partenaireId: partnerId, echeanceId: dto.echeanceId, montant: dto.montant,
        datePaiement: dto.datePaiement,
      });
      return inserted.rows[0];
    });
  }

  private async audit(
    client: PoolClient, userId: string, action: string, entityType: string, entityId: string,
    oldValues: unknown, newValues: unknown,
  ) {
    await client.query(
      `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, oldValues ? JSON.stringify(oldValues) : null, JSON.stringify(newValues)],
    );
  }
}
