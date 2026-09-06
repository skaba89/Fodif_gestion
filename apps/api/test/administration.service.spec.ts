import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdministrationRepository } from '../src/administration/administration.repository';
import { AdministrationService } from '../src/administration/administration.service';

describe('AdministrationService', () => {
  it('refuses a PME account without an enterprise scope', async () => {
    const repository = {} as AdministrationRepository;
    const service = new AdministrationService(repository);

    await expect(service.createUser('admin', {
      email: 'pme@example.com', nom: 'PME', password: 'Password2026!', roles: ['PME'],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a PARTENAIRE_BANCAIRE account without a partner bank scope (axe D1)', async () => {
    const repository = {} as AdministrationRepository;
    const service = new AdministrationService(repository);

    await expect(service.createUser('admin', {
      email: 'partner@example.com', nom: 'Partner', password: 'Password2026!', roles: ['PARTENAIRE_BANCAIRE'],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes enterprise and partner bank codes before persistence', async () => {
    const repository = {
      createEnterprise: jest.fn().mockResolvedValue({ id: 'enterprise-1' }),
      createPartnerBank: jest.fn().mockResolvedValue({ id: 'bank-1' }),
    } as unknown as AdministrationRepository;
    const service = new AdministrationService(repository);

    await service.createEnterprise('admin', {
      codeFodip: ' pme-001 ', raisonSociale: ' PME Exemple ', nomCommercial: ' Exemple ',
    });
    await service.createPartnerBank('admin', { code: ' bank-01 ', raisonSociale: ' Banque Exemple ' });

    expect(repository.createEnterprise).toHaveBeenCalledWith('admin', {
      codeFodip: 'PME-001', raisonSociale: 'PME Exemple', nomCommercial: 'Exemple',
    });
    expect(repository.createPartnerBank).toHaveBeenCalledWith('admin', {
      code: 'BANK-01', raisonSociale: 'Banque Exemple',
    });
  });

  it('maps duplicate enterprise and partner bank codes to conflicts', async () => {
    const duplicate = Object.assign(new Error('duplicate'), { code: '23505' });
    const repository = {
      createEnterprise: jest.fn().mockRejectedValue(duplicate),
      createPartnerBank: jest.fn().mockRejectedValue(duplicate),
    } as unknown as AdministrationRepository;
    const service = new AdministrationService(repository);

    await expect(service.createEnterprise('admin', { codeFodip: 'PME-001', raisonSociale: 'PME' }))
      .rejects.toBeInstanceOf(ConflictException);
    await expect(service.createPartnerBank('admin', { code: 'BANK-01', raisonSociale: 'Banque' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('normalizes roles and hashes the password before persistence', async () => {
    const repository = {
      create: jest.fn().mockResolvedValue({ id: 'user-1' }),
    } as unknown as AdministrationRepository;
    const service = new AdministrationService(repository);

    await service.createUser('admin', {
      email: 'agent@example.com', nom: 'Agent', password: 'Password2026!', roles: [' agent_fodip ', 'AGENT_FODIP'],
    });

    const input = (repository.create as jest.Mock).mock.calls[0][1];
    expect(input.roles).toEqual(['AGENT_FODIP']);
    expect(input.passwordHash).not.toBe('Password2026!');
    expect(input.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('maps repository protections to safe HTTP errors', async () => {
    const protectedRepository = {
      update: jest.fn().mockResolvedValue({ error: 'PROTECTED_SUPER_ADMIN' }),
    } as unknown as AdministrationRepository;
    await expect(new AdministrationService(protectedRepository).updateUser('admin', 'other', { actif: false }))
      .rejects.toBeInstanceOf(ForbiddenException);

    const missingRepository = {
      update: jest.fn().mockResolvedValue({ error: 'NOT_FOUND' }),
    } as unknown as AdministrationRepository;
    await expect(new AdministrationService(missingRepository).updateUser('admin', 'missing', { actif: false }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
