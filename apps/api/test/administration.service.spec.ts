import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
