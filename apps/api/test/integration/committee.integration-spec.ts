/**
 * Real-PostgreSQL integration coverage for committee decisions (Sprint Enterprise 0, Lot 2 -
 * docs/14-ROADMAP-SAAS-PREMIUM.md axe E2, follow-up to the financings module covered in PR #40).
 * `test/committee.service.spec.ts` already covers the service's own branching against a mocked
 * repository; `committee.repository.ts` itself had only 22.22% line coverage before this file -
 * the mocks never reach its single-UPDATE-statement concurrency guard
 * (`WHERE statut = 'PRET_COMITE'`), which is exactly what a real committee session risks: two
 * members (or one member double-clicking) deciding the same dossier at the same time.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthenticatedUser } from '../../src/auth/auth-user.interface';
import { CommitteeRepository } from '../../src/committee/committee.repository';
import { CommitteeService } from '../../src/committee/committee.service';
import { seedDossierReadyForCommittee, seedUser } from './support/fixtures';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

describe('Committee decisions (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let repository: CommitteeRepository;
  let service: CommitteeService;
  let user: AuthenticatedUser;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    repository = new CommitteeRepository(integrationDb.db);
    service = new CommitteeService(repository);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
    const member = await seedUser(integrationDb.pool);
    user = { sub: member.id, email: 'comite@fodip.test', roles: ['COMITE_FINANCEMENT'], permissions: [] };
  });

  describe('decide', () => {
    it('records an APPROUVE decision, moves the dossier to APPROUVE, and keeps a full audit trail', async () => {
      const dossier = await seedDossierReadyForCommittee(integrationDb.pool, { montantDemande: 1_000_000 });

      const result = await service.decide(user, dossier.dossierId, {
        decision: 'APPROUVE', montantApprouve: 900_000, tauxInteret: 5, dureeMois: 24,
      });

      expect(result.statut).toBe('APPROUVE');
      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0]).toMatchObject({ decision: 'APPROUVE', montantApprouve: '900000.00' });

      const history = await integrationDb.pool.query(
        `SELECT ancien_statut AS "ancienStatut", nouveau_statut AS "nouveauStatut" FROM dossier_statuts_historique WHERE dossier_id = $1`,
        [dossier.dossierId],
      );
      expect(history.rows).toEqual([{ ancienStatut: 'PRET_COMITE', nouveauStatut: 'APPROUVE' }]);

      const audit = await integrationDb.pool.query(
        `SELECT action FROM audit_logs WHERE entity_type = 'DOSSIER_FINANCEMENT' AND entity_id = $1`,
        [dossier.dossierId],
      );
      expect(audit.rows.map((row) => row.action)).toContain('COMMITTEE_DECISION');
    });

    it('rejects an approved amount above the requested amount', async () => {
      const dossier = await seedDossierReadyForCommittee(integrationDb.pool, { montantDemande: 500_000 });

      await expect(service.decide(user, dossier.dossierId, {
        decision: 'APPROUVE', montantApprouve: 500_001, dureeMois: 12,
      })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a motivated comment for a REJETE decision', async () => {
      const dossier = await seedDossierReadyForCommittee(integrationDb.pool);

      await expect(service.decide(user, dossier.dossierId, { decision: 'REJETE' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('forbidden state: deciding twice on the same dossier is rejected the second time', async () => {
      const dossier = await seedDossierReadyForCommittee(integrationDb.pool);
      await service.decide(user, dossier.dossierId, { decision: 'REJETE', commentaire: 'Dossier incomplet' });

      await expect(service.decide(user, dossier.dossierId, { decision: 'APPROUVE', montantApprouve: 100, dureeMois: 12 }))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('double-click / double-submission: two committee members deciding the same dossier at once - exactly one wins', async () => {
      const dossier = await seedDossierReadyForCommittee(integrationDb.pool, { montantDemande: 1_000_000 });

      const results = await Promise.allSettled([
        service.decide(user, dossier.dossierId, { decision: 'APPROUVE', montantApprouve: 800_000, dureeMois: 18 }),
        service.decide(user, dossier.dossierId, { decision: 'REJETE', commentaire: 'Risque jugé trop élevé' }),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);

      // The database itself, not just application logic, guarantees only one decision is ever
      // recorded for a dossier: exactly one row in decisions_comite, and the dossier's final
      // status matches whichever decision actually won the race (not necessarily the first call).
      const decisions = await integrationDb.pool.query(
        `SELECT decision FROM decisions_comite WHERE dossier_id = $1`, [dossier.dossierId],
      );
      expect(decisions.rows).toHaveLength(1);

      const finalStatus = await integrationDb.pool.query(
        `SELECT statut FROM dossiers_financement WHERE id = $1`, [dossier.dossierId],
      );
      expect(finalStatus.rows[0].statut).toBe(decisions.rows[0].decision);
    });
  });

  describe('list', () => {
    it('only lists dossiers awaiting committee review, ordered oldest-updated first', async () => {
      const first = await seedDossierReadyForCommittee(integrationDb.pool);
      const second = await seedDossierReadyForCommittee(integrationDb.pool);
      // Not PRET_COMITE - must never appear in the committee's queue.
      const notReady = await seedDossierReadyForCommittee(integrationDb.pool);
      await integrationDb.pool.query(`UPDATE dossiers_financement SET statut = 'EN_INSTRUCTION' WHERE id = $1`, [notReady.dossierId]);

      const page = await service.list({ page: 1, limite: 25 });

      const ids = page.items.map((item) => item.id as string);
      expect(ids).toEqual(expect.arrayContaining([first.dossierId, second.dossierId]));
      expect(ids).not.toContain(notReady.dossierId);
    });
  });
});
