import { Injectable } from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { Installment } from '../finance-policy';
import { ExecuteDisbursementDto } from './dto/execute-disbursement.dto';
import { ListFinancingsDto } from './dto/list-financings.dto';
import { PlanDisbursementDto } from './dto/plan-disbursement.dto';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { SaveImpactDto } from './dto/save-impact.dto';

interface EligibleRow extends QueryResultRow {
  dossierId: string;
  entrepriseId: string;
  montantApprouve: string;
  tauxInteret: string | null;
  dureeMois: number;
}

interface PaymentContextRow extends QueryResultRow {
  montantTotalDu: string;
  montantPaye: string;
}

// Axe E5 (docs/14-ROADMAP-SAAS-PREMIUM.md) - maker-checker on disbursement execution. A
// discriminated result rather than null/throw: three distinct reasons nothing happened need three
// distinct HTTP responses (404/409/403), and FinancingsService is where that translation belongs.
export type ExecuteDisbursementOutcome =
  | { outcome: 'NOT_FOUND' }
  | { outcome: 'INVALID_STATE' }
  | { outcome: 'SELF_APPROVAL' }
  | { outcome: 'OK'; id: string };

@Injectable()
export class FinancingsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(query: ListFinancingsDto) {
    const offset = (query.page - 1) * query.limite;
    const result = await this.db.query(
      `SELECT financing.financement_id AS id, financement.numero_financement AS "numeroFinancement",
        financing.dossier_id AS "dossierId", dossier.numero_dossier AS "numeroDossier",
        financement.entreprise_id AS "entrepriseId", entreprise.raison_sociale AS "raisonSociale",
        financing.region_nom AS region, programme.nom AS programme,
        financing.montant_accorde AS "montantAccorde", financing.montant_decaisse AS "montantDecaisse",
        financing.montant_du AS "montantDu", financing.montant_rembourse AS "montantRembourse",
        financing.impaye, financement.taux_interet AS "tauxInteret",
        financement.duree_mois AS "dureeMois", financement.date_debut AS "dateDebut",
        financement.date_fin_prevue AS "dateFinPrevue", financement.statut,
        COUNT(*) OVER()::INT AS "total"
       FROM analytics.vw_financing_performance financing
       JOIN financements financement ON financement.id = financing.financement_id
       JOIN dossiers_financement dossier ON dossier.id = financing.dossier_id
       JOIN entreprises entreprise ON entreprise.id = financing.entreprise_id
       LEFT JOIN programmes_fodip programme ON programme.id = financing.programme_id
       ORDER BY financement.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [query.limite, offset],
    );
    const total = Number(result.rows[0]?.total ?? 0);
    const items = result.rows.map(({ total: _total, ...item }) => item);
    return { items, total, page: query.page, limite: query.limite };
  }

  async listEligibleApplications() {
    const result = await this.db.query(
      `SELECT portfolio.dossier_id AS id, portfolio.numero_dossier AS "numeroDossier",
        portfolio.raison_sociale AS "raisonSociale", portfolio.programme_nom AS programme,
        portfolio.montant_demande AS "montantDemande", portfolio.montant_approuve AS "montantApprouve",
        decision.taux_interet AS "tauxInteret", decision.duree_mois AS "dureeMois",
        portfolio.date_decision AS "dateDecision"
       FROM analytics.vw_dossier_portfolio portfolio
       JOIN LATERAL (
         SELECT taux_interet, duree_mois FROM decisions_comite
         WHERE dossier_id = portfolio.dossier_id ORDER BY date_decision DESC LIMIT 1
       ) decision ON TRUE
       WHERE portfolio.statut = 'APPROUVE' AND portfolio.decision = 'APPROUVE'
         AND portfolio.montant_approuve > 0 AND decision.duree_mois BETWEEN 1 AND 120
         AND NOT EXISTS (SELECT 1 FROM financements WHERE dossier_id = portfolio.dossier_id)
       ORDER BY portfolio.date_decision ASC`,
    );
    return { items: result.rows, total: result.rowCount };
  }

  async findEligibleApplication(id: string) {
    const result = await this.db.query<EligibleRow>(
      `SELECT dossier.id AS "dossierId", dossier.entreprise_id AS "entrepriseId",
        decision.montant_approuve AS "montantApprouve", decision.taux_interet AS "tauxInteret",
        decision.duree_mois AS "dureeMois"
       FROM dossiers_financement dossier
       JOIN LATERAL (
         SELECT montant_approuve, taux_interet, duree_mois, decision
         FROM decisions_comite WHERE dossier_id = dossier.id ORDER BY date_decision DESC LIMIT 1
       ) decision ON TRUE
       WHERE dossier.id = $1 AND dossier.statut = 'APPROUVE' AND decision.decision = 'APPROUVE'
         AND decision.montant_approuve > 0 AND decision.duree_mois BETWEEN 1 AND 120
         AND NOT EXISTS (SELECT 1 FROM financements WHERE dossier_id = dossier.id)
       LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async createFromApplication(
    application: EligibleRow,
    userId: string,
    dateSignature: string,
    dateDebut: string,
    schedule: Installment[],
  ) {
    return this.db.transaction(async (client) => {
      await client.query('SELECT id FROM dossiers_financement WHERE id = $1 FOR UPDATE', [application.dossierId]);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO financements (
          numero_financement, dossier_id, entreprise_id, montant_accorde, taux_interet,
          duree_mois, date_signature, date_debut, date_fin_prevue, statut, created_by
        ) VALUES (
          'FIN-' || EXTRACT(YEAR FROM $6::date)::int || '-' || LPAD(nextval('financement_numero_seq')::text, 6, '0'),
          $1, $2, $3, $4, $5, $6, $7, $8, 'ACTIF', $9
        ) RETURNING id`,
        [application.dossierId, application.entrepriseId, application.montantApprouve,
          application.tauxInteret ?? 0, application.dureeMois, dateSignature, dateDebut,
          schedule.at(-1)?.dueDate, userId],
      );
      const financingId = inserted.rows[0].id;
      await client.query(
        `INSERT INTO echeances (
          financement_id, numero_echeance, date_echeance, capital_du, interet_du, montant_total_du, statut
        ) SELECT $1, item."installmentNumber", item."dueDate"::date, item."capitalDue",
          item."interestDue", item."totalDue", 'A_VENIR'
        FROM jsonb_to_recordset($2::jsonb) AS item(
          "installmentNumber" integer, "dueDate" text, "capitalDue" numeric,
          "interestDue" numeric, "totalDue" numeric
        )`,
        [financingId, JSON.stringify(schedule)],
      );
      await this.audit(client, userId, 'CREATE_FINANCING', 'FINANCEMENT', financingId, null, {
        dossierId: application.dossierId, montantAccorde: application.montantApprouve,
        dureeMois: application.dureeMois, echeances: schedule.length,
      });
      return financingId;
    });
  }

  async findById(id: string) {
    const baseResult = await this.db.query(
      `SELECT financement.id, financement.numero_financement AS "numeroFinancement",
        financement.dossier_id AS "dossierId", dossier.numero_dossier AS "numeroDossier",
        financement.entreprise_id AS "entrepriseId", entreprise.raison_sociale AS "raisonSociale",
        programme.nom AS programme, region.nom AS region, financement.montant_accorde AS "montantAccorde",
        financement.taux_interet AS "tauxInteret", financement.duree_mois AS "dureeMois",
        financement.date_signature AS "dateSignature", financement.date_debut AS "dateDebut",
        financement.date_fin_prevue AS "dateFinPrevue", financement.statut
       FROM financements financement
       JOIN dossiers_financement dossier ON dossier.id = financement.dossier_id
       JOIN entreprises entreprise ON entreprise.id = financement.entreprise_id
       LEFT JOIN programmes_fodip programme ON programme.id = dossier.programme_id
       LEFT JOIN regions region ON region.id = entreprise.region_id
       WHERE financement.id = $1 LIMIT 1`,
      [id],
    );
    if (!baseResult.rows[0]) return null;
    const [disbursements, installments, impact, audit] = await Promise.all([
      this.db.query(
        `SELECT id, numero_decaissement AS "numeroDecaissement", montant, date_prevue AS "datePrevue",
          date_effective AS "dateEffective", reference_bancaire AS "referenceBancaire", statut, created_at AS "createdAt"
         FROM decaissements WHERE financement_id = $1 ORDER BY numero_decaissement ASC`, [id],
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
         GROUP BY echeance.id ORDER BY echeance.numero_echeance ASC`, [id],
      ),
      this.db.query(
        `SELECT id, periode, chiffre_affaires AS "chiffreAffaires", nombre_employes AS "nombreEmployes",
          emplois_femmes AS "emploisFemmes", emplois_hommes AS "emploisHommes", emplois_jeunes AS "emploisJeunes",
          emplois_crees AS "emploisCrees", emplois_maintenus AS "emploisMaintenus",
          chiffre_export AS "chiffreExport", production_locale AS "productionLocale", commentaire
         FROM suivis_impact WHERE financement_id = $1 ORDER BY periode DESC`, [id],
      ),
      this.db.query(
        `SELECT id, action, old_values AS "oldValues", new_values AS "newValues", created_at AS "createdAt"
         FROM audit_logs WHERE entity_type IN ('FINANCEMENT', 'DECAISSEMENT', 'REMBOURSEMENT', 'SUIVI_IMPACT')
           AND (entity_id = $1 OR new_values->>'financementId' = $1::text)
         ORDER BY created_at DESC LIMIT 100`, [id],
      ),
    ]);
    return { ...baseResult.rows[0], disbursements: disbursements.rows, installments: installments.rows, impact: impact.rows, audit: audit.rows };
  }

  async planDisbursement(financingId: string, userId: string, dto: PlanDisbursementDto) {
    return this.db.transaction(async (client) => {
      const locked = await client.query<{ montantAccorde: string }>(
        `SELECT montant_accorde AS "montantAccorde" FROM financements
         WHERE id = $1 AND statut = 'ACTIF' FOR UPDATE`, [financingId],
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
          financement_id, numero_decaissement, montant, date_prevue, statut, created_by
        ) VALUES ($1, $2, $3, $4, 'PREVU', $5) RETURNING id`,
        [financingId, totals.rows[0].nextNumber, dto.montant, dto.datePrevue, userId],
      );
      await this.audit(client, userId, 'PLAN_DISBURSEMENT', 'DECAISSEMENT', inserted.rows[0].id, null, {
        financementId: financingId, montant: dto.montant, numero: totals.rows[0].nextNumber,
      });
      return inserted.rows[0];
    });
  }

  async executeDisbursement(
    financingId: string, disbursementId: string, userId: string, dto: ExecuteDisbursementDto,
  ): Promise<ExecuteDisbursementOutcome> {
    return this.db.transaction(async (client) => {
      // Locked and read first, rather than folding everything into one UPDATE ... WHERE, so the
      // service layer can tell apart *why* nothing happened: not found, already executed/cancelled,
      // or the maker-checker rule itself (same person cannot plan and execute the same
      // disbursement - axe E5, docs/14-ROADMAP-SAAS-PREMIUM.md) - three different HTTP responses,
      // not one generic conflict.
      const locked = await client.query<{ createdBy: string | null; statut: string }>(
        `SELECT created_by AS "createdBy", statut FROM decaissements
         WHERE id = $1 AND financement_id = $2 FOR UPDATE`,
        [disbursementId, financingId],
      );
      if (!locked.rows[0]) return { outcome: 'NOT_FOUND' };
      if (locked.rows[0].statut !== 'PREVU') return { outcome: 'INVALID_STATE' };
      if (locked.rows[0].createdBy && locked.rows[0].createdBy === userId) return { outcome: 'SELF_APPROVAL' };

      const updated = await client.query<{ id: string; montant: string }>(
        `UPDATE decaissements SET statut = 'EFFECTUE', date_effective = $3, reference_bancaire = $4, executed_by = $5
         WHERE id = $1 AND financement_id = $2
         RETURNING id, montant`,
        [disbursementId, financingId, dto.dateEffective, dto.referenceBancaire.trim(), userId],
      );
      const row = updated.rows[0];
      await this.audit(client, userId, 'EXECUTE_DISBURSEMENT', 'DECAISSEMENT', row.id,
        { statut: 'PREVU' },
        { financementId: financingId, statut: 'EFFECTUE', montant: row.montant, reference: dto.referenceBancaire.trim() });
      return { outcome: 'OK', id: row.id };
    });
  }

  async createRepayment(financingId: string, userId: string, dto: CreateRepaymentDto) {
    return this.db.transaction(async (client) => {
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
      if (!row || Number(row.montantPaye) + dto.montant > Number(row.montantTotalDu) + 0.001) return null;
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
      await this.audit(client, userId, 'CREATE_REPAYMENT', 'REMBOURSEMENT', inserted.rows[0].id, null, {
        financementId: financingId, echeanceId: dto.echeanceId, montant: dto.montant, datePaiement: dto.datePaiement,
      });
      return inserted.rows[0];
    });
  }

  async saveImpact(financingId: string, entrepriseId: string, userId: string, dto: SaveImpactDto) {
    return this.db.transaction(async (client) => {
      const previous = await client.query(
        `SELECT to_jsonb(impact) AS value FROM suivis_impact impact
         WHERE financement_id = $1 AND periode = $2 FOR UPDATE`, [financingId, dto.periode],
      );
      const result = await client.query<{ id: string }>(
        `INSERT INTO suivis_impact (
          entreprise_id, financement_id, periode, chiffre_affaires, nombre_employes,
          emplois_femmes, emplois_hommes, emplois_jeunes, emplois_crees, emplois_maintenus,
          chiffre_export, production_locale, commentaire, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (financement_id, periode) WHERE financement_id IS NOT NULL DO UPDATE SET
          chiffre_affaires = EXCLUDED.chiffre_affaires, nombre_employes = EXCLUDED.nombre_employes,
          emplois_femmes = EXCLUDED.emplois_femmes, emplois_hommes = EXCLUDED.emplois_hommes,
          emplois_jeunes = EXCLUDED.emplois_jeunes, emplois_crees = EXCLUDED.emplois_crees,
          emplois_maintenus = EXCLUDED.emplois_maintenus, chiffre_export = EXCLUDED.chiffre_export,
          production_locale = EXCLUDED.production_locale, commentaire = EXCLUDED.commentaire,
          created_by = EXCLUDED.created_by, created_at = NOW()
        RETURNING id`,
        [entrepriseId, financingId, dto.periode, dto.chiffreAffaires ?? null, dto.nombreEmployes ?? null,
          dto.emploisFemmes ?? null, dto.emploisHommes ?? null, dto.emploisJeunes ?? null,
          dto.emploisCrees ?? null, dto.emploisMaintenus ?? null, dto.chiffreExport ?? null,
          dto.productionLocale ?? null, dto.commentaire?.trim() || null, userId],
      );
      await this.audit(client, userId, previous.rowCount ? 'UPDATE_IMPACT' : 'CREATE_IMPACT', 'SUIVI_IMPACT', result.rows[0].id,
        previous.rows[0]?.value ?? null, { ...dto, financementId: financingId });
      return result.rows[0];
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
