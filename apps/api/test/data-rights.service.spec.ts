import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataRightsService } from '../src/data-rights/data-rights.service';

const pmeUser = {
  sub: 'user-1', email: 'pme@example.com', roles: ['ENTREPRENEUR'], permissions: [], entrepriseId: 'ent-1',
};
const staffUser = { sub: 'user-2', email: 'staff@fodip.gov.gn', roles: ['AGENT_FODIP'], permissions: [] };

describe('DataRightsService', () => {
  describe('exportOwnData', () => {
    it('throws not found when the account itself no longer exists', async () => {
      const repository = { exportProfile: jest.fn().mockResolvedValue(null) };
      const service = new DataRightsService(repository as never);
      await expect(service.exportOwnData(pmeUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('assembles profile, entreprise, dirigeants and dossiers for a PME account, and audits the export', async () => {
      const repository = {
        exportProfile: jest.fn().mockResolvedValue({ id: 'user-1', email: 'pme@example.com' }),
        exportEnterprise: jest.fn().mockResolvedValue({ id: 'ent-1', raisonSociale: 'ACME' }),
        exportDirigeants: jest.fn().mockResolvedValue([{ id: 'dir-1', nom: 'Diallo' }]),
        exportDossiers: jest.fn().mockResolvedValue([{ id: 'd-1', statut: 'SOUMIS' }]),
        auditExport: jest.fn().mockResolvedValue(undefined),
      };
      const service = new DataRightsService(repository as never);

      const result = await service.exportOwnData(pmeUser);

      expect(repository.exportEnterprise).toHaveBeenCalledWith('ent-1');
      expect(repository.exportDirigeants).toHaveBeenCalledWith('ent-1');
      expect(repository.exportDossiers).toHaveBeenCalledWith('ent-1');
      expect(repository.auditExport).toHaveBeenCalledWith('user-1');
      expect(result.profile).toEqual({ id: 'user-1', email: 'pme@example.com' });
      expect(result.entreprise).toEqual({ id: 'ent-1', raisonSociale: 'ACME' });
      expect(result.dirigeants).toEqual([{ id: 'dir-1', nom: 'Diallo' }]);
      expect(result.dossiers).toEqual([{ id: 'd-1', statut: 'SOUMIS' }]);
      expect(typeof result.generatedAt).toBe('string');
    });

    it('omits the enterprise section for an account with no entrepriseId (FODIP staff, partner bank...)', async () => {
      const repository = {
        exportProfile: jest.fn().mockResolvedValue({ id: 'user-2', email: 'staff@fodip.gov.gn' }),
        auditExport: jest.fn().mockResolvedValue(undefined),
      };
      const service = new DataRightsService(repository as never);

      const result = await service.exportOwnData(staffUser);

      expect(result).not.toHaveProperty('entreprise');
      expect(result).not.toHaveProperty('dirigeants');
      expect(result).not.toHaveProperty('dossiers');
    });
  });

  describe('anonymizeUser', () => {
    it('translates NOT_FOUND into a NotFoundException', async () => {
      const repository = { anonymize: jest.fn().mockResolvedValue({ error: 'NOT_FOUND' }) };
      const service = new DataRightsService(repository as never);
      await expect(service.anonymizeUser('actor-1', 'target-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('translates ALREADY_ANONYMIZED into a ConflictException', async () => {
      const repository = { anonymize: jest.fn().mockResolvedValue({ error: 'ALREADY_ANONYMIZED' }) };
      const service = new DataRightsService(repository as never);
      await expect(service.anonymizeUser('actor-1', 'target-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('translates PROTECTED_SUPER_ADMIN (self or last active super-admin) into a ForbiddenException', async () => {
      const repository = { anonymize: jest.fn().mockResolvedValue({ error: 'PROTECTED_SUPER_ADMIN' }) };
      const service = new DataRightsService(repository as never);
      await expect(service.anonymizeUser('actor-1', 'actor-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns the anonymized user id on success', async () => {
      const repository = { anonymize: jest.fn().mockResolvedValue({ id: 'target-1' }) };
      const service = new DataRightsService(repository as never);
      await expect(service.anonymizeUser('actor-1', 'target-1')).resolves.toEqual({ id: 'target-1' });
      expect(repository.anonymize).toHaveBeenCalledWith('actor-1', 'target-1');
    });
  });
});
