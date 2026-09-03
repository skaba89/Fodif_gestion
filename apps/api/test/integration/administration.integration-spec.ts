/**
 * Real-PostgreSQL integration coverage for user administration (Sprint Enterprise 0, Lot 2 -
 * docs/14-ROADMAP-SAAS-PREMIUM.md axe E2, follow-up to financings and committee).
 * `test/administration.service.spec.ts` and `test/administration.repository.spec.ts` already
 * cover branching logic against mocks/an in-memory pg stub; this file targets two things mocks
 * structurally cannot verify: the real AES-256-GCM round trip of a phone number through actual
 * PostgreSQL storage (axe B5), and the `pg_advisory_xact_lock`-based global serialization that
 * protects the platform's last active SUPER_ADMIN from being removed by two concurrent requests -
 * a protection whose entire point is a real race between two real transactions.
 */
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdministrationRepository } from '../../src/administration/administration.repository';
import { AdministrationService } from '../../src/administration/administration.service';
import { seedUser, seedUserWithRoles } from './support/fixtures';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

const STRONG_PASSWORD = 'Sup3r!Secret2026';

describe('Administration (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let repository: AdministrationRepository;
  let service: AdministrationService;
  // audit_logs.utilisateur_id is a real FK to utilisateurs(id) - every write path here goes
  // through AdministrationRepository.audit(), so actorId must be a real seeded user, not a
  // placeholder string.
  let actorId: string;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    // AdministrationRepository derives its PII encryption key from JWT_SECRET via ConfigService -
    // an empty ConfigService is fine (resolveJwtSecret falls back to a safe dev-only default
    // outside NODE_ENV=production, see src/security-policy.js), so no env var needs setting here.
    repository = new AdministrationRepository(integrationDb.db, new ConfigService({}));
    service = new AdministrationService(repository);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
    actorId = (await seedUser(integrationDb.pool)).id;
  });

  function newUserDto(overrides: Partial<Parameters<AdministrationService['createUser']>[1]> = {}) {
    const unique = Math.random().toString(36).slice(2, 10);
    return {
      email: `agent-${unique}@fodip.test`, nom: 'Test', password: STRONG_PASSWORD,
      roles: ['ANALYSTE'], ...overrides,
    };
  }

  describe('createUser', () => {
    it('encrypts the phone number at rest and decrypts it back correctly on listUsers', async () => {
      const created = await service.createUser(actorId, newUserDto({ telephone: '+224 621 00 00 00' }));

      const raw = await integrationDb.pool.query<{ telephone: string }>('SELECT telephone FROM utilisateurs WHERE id = $1', [created.id]);
      expect(raw.rows[0].telephone).not.toContain('621 00 00 00'); // never the plaintext at rest
      expect(raw.rows[0].telephone.length).toBeGreaterThan(20); // base64(iv + authTag + ciphertext), not a bare phone number

      const { items } = await service.listUsers();
      const listed = (items as unknown as Array<{ id: string; telephone: string | null }>).find((item) => item.id === created.id)!;
      expect(listed.telephone).toBe('+224 621 00 00 00');
    });

    it('forces MFA for a privileged role even when the caller explicitly opts out', async () => {
      const created = await service.createUser(actorId, newUserDto({ roles: ['AGENT_FODIP'], mfaRequired: false }));
      const { items } = await service.listUsers();
      const listed = (items as unknown as Array<{ id: string; mfaRequired: boolean }>).find((item) => item.id === created.id)!;
      expect(listed.mfaRequired).toBe(true);
    });

    it('rejects a duplicate email (real unique constraint, not just application logic)', async () => {
      const dto = newUserDto();
      await service.createUser(actorId, dto);
      await expect(service.createUser(actorId, { ...dto, roles: ['ANALYSTE'] })).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an unknown role code', async () => {
      await expect(service.createUser(actorId, newUserDto({ roles: ['ROLE_QUI_NEXISTE_PAS'] })))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateUser - self-deactivation guard', () => {
    it('forbids a user from deactivating their own account', async () => {
      const self = await seedUserWithRoles(integrationDb.pool, ['ANALYSTE']);
      await expect(service.updateUser(self.id, self.id, { actif: false })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('updateUser - last SUPER_ADMIN protection', () => {
    it('forbids deactivating the sole active SUPER_ADMIN', async () => {
      const actor = await seedUserWithRoles(integrationDb.pool, ['ANALYSTE']);
      const soleSuperAdmin = await seedUserWithRoles(integrationDb.pool, ['SUPER_ADMIN']);

      await expect(service.updateUser(actor.id, soleSuperAdmin.id, { actif: false })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows deactivating a SUPER_ADMIN as long as another active one remains', async () => {
      const actor = await seedUserWithRoles(integrationDb.pool, ['ANALYSTE']);
      await seedUserWithRoles(integrationDb.pool, ['SUPER_ADMIN']); // the one that stays active
      const target = await seedUserWithRoles(integrationDb.pool, ['SUPER_ADMIN']);

      await service.updateUser(actor.id, target.id, { actif: false });

      const row = await integrationDb.pool.query<{ actif: boolean }>('SELECT actif FROM utilisateurs WHERE id = $1', [target.id]);
      expect(row.rows[0].actif).toBe(false);
    });

    it('double-click / double-submission: two concurrent requests each deactivating one of exactly two active SUPER_ADMINs - exactly one succeeds, one SUPER_ADMIN always stays active', async () => {
      const actor = await seedUserWithRoles(integrationDb.pool, ['ANALYSTE']);
      const superAdminA = await seedUserWithRoles(integrationDb.pool, ['SUPER_ADMIN']);
      const superAdminB = await seedUserWithRoles(integrationDb.pool, ['SUPER_ADMIN']);

      const results = await Promise.allSettled([
        service.updateUser(actor.id, superAdminA.id, { actif: false }),
        service.updateUser(actor.id, superAdminB.id, { actif: false }),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ForbiddenException);

      // The invariant pg_advisory_xact_lock exists to guarantee: never zero active SUPER_ADMIN,
      // regardless of which of the two concurrent requests the database happened to serialize first.
      const activeSuperAdmins = await integrationDb.pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM utilisateurs utilisateur
         JOIN utilisateur_roles utilisateur_role ON utilisateur_role.utilisateur_id = utilisateur.id
         JOIN roles role ON role.id = utilisateur_role.role_id
         WHERE utilisateur.actif = TRUE AND role.code = 'SUPER_ADMIN'`,
      );
      expect(Number(activeSuperAdmins.rows[0].total)).toBe(1);
    });
  });

  describe('updateUser - audit trail', () => {
    it('writes an audit log entry for a successful role change', async () => {
      const actor = await seedUserWithRoles(integrationDb.pool, ['SUPER_ADMIN']);
      const target = await seedUserWithRoles(integrationDb.pool, ['ANALYSTE']);

      await service.updateUser(actor.id, target.id, { roles: ['AGENT_FODIP'] });

      const audit = await integrationDb.pool.query(
        `SELECT action FROM audit_logs WHERE entity_type = 'UTILISATEUR' AND entity_id = $1`, [target.id],
      );
      expect(audit.rows.map((row) => row.action)).toContain('UPDATE_USER');
    });
  });
});
