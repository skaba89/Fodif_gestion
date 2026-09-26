/**
 * Real-PostgreSQL coverage for the "drill-down dossier" item of issue #142's Auditeur checklist:
 * AuditService#dossier (backed by AuditController's `GET audit/dossiers/:id`) must return any
 * dossier's full detail plus its chronological audit trail, with no agent-ownership filtering —
 * AUDITEUR is a global read-only oversight role, unlike AgentApplicationsService#get which the
 * AGENT_FODIP endpoint uses and which deliberately hides dossiers outside the caller's workload.
 * A mocked repository can't catch a wrong join or a stray WHERE clause silently returning zero
 * rows instead of throwing, so this runs against a real database.
 */
import { NotFoundException } from '@nestjs/common';
import { AgentApplicationsRepository } from '../../src/agent-applications/agent-applications.repository';
import { AuditRepository } from '../../src/audit/audit.repository';
import { AuditService } from '../../src/audit/audit.service';
import { seedEditableDossier, seedUser } from './support/fixtures';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

describe('AuditService#dossier drill-down (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let auditRepository: AuditRepository;
  let agentApplicationsRepository: AgentApplicationsRepository;
  let service: AuditService;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    auditRepository = new AuditRepository(integrationDb.db);
    agentApplicationsRepository = new AgentApplicationsRepository(integrationDb.db);
    service = new AuditService(auditRepository, agentApplicationsRepository);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
  });

  it('returns a dossier that has no agent assigned at all — no ownership check blocks AUDITEUR', async () => {
    const { dossierId } = await seedEditableDossier(integrationDb.pool);
    await integrationDb.pool.query(`UPDATE dossiers_financement SET statut = 'SOUMIS' WHERE id = $1`, [dossierId]);

    const result = await service.dossier(dossierId);

    expect(result.id).toBe(dossierId);
    expect(result.agentResponsableId ?? null).toBeNull();
    expect(result.auditTrail).toEqual([]);
  });

  it('returns a dossier assigned to a different agent than the caller — AUDITEUR has no owner of its own', async () => {
    const { dossierId } = await seedEditableDossier(integrationDb.pool);
    const otherAgent = await seedUser(integrationDb.pool);
    await integrationDb.pool.query(
      `UPDATE dossiers_financement SET statut = 'EN_INSTRUCTION', agent_responsable_id = $2 WHERE id = $1`,
      [dossierId, otherAgent.id],
    );

    const result = await service.dossier(dossierId);

    expect(result.id).toBe(dossierId);
    expect(result.agentResponsableId).toBe(otherAgent.id);
  });

  it('throws NotFoundException for an id that does not exist', async () => {
    await expect(service.dossier('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the audit trail is the dossier\'s own logs plus the FINANCEMENT creation event carrying its dossierId, in chronological order', async () => {
    const { dossierId } = await seedEditableDossier(integrationDb.pool);
    const actor = await seedUser(integrationDb.pool);
    const financementId = '11111111-1111-1111-1111-111111111111';
    const otherDossierId = '22222222-2222-2222-2222-222222222222';

    await integrationDb.pool.query(
      `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, created_at)
       VALUES ($1, 'CREATE_DOSSIER', 'DOSSIER_FINANCEMENT', $2, '2026-09-14T09:00:00Z')`,
      [actor.id, dossierId],
    );
    await integrationDb.pool.query(
      `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, new_values, created_at)
       VALUES ($1, 'CREATE_FINANCING', 'FINANCEMENT', $2, jsonb_build_object('dossierId', $3::text), '2026-09-20T09:00:00Z')`,
      [actor.id, financementId, dossierId],
    );
    // Belongs to a different dossier entirely — must never leak into this dossier's trail.
    await integrationDb.pool.query(
      `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, created_at)
       VALUES ($1, 'CREATE_DOSSIER', 'DOSSIER_FINANCEMENT', $2, '2026-09-15T09:00:00Z')`,
      [actor.id, otherDossierId],
    );

    const result = await service.dossier(dossierId);

    const actions = (result.auditTrail as Array<{ action: string }>).map((entry) => entry.action);
    expect(actions).toEqual(['CREATE_FINANCING', 'CREATE_DOSSIER']);
  });
});
