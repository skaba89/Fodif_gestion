import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { DocumentsService } from '../src/documents/documents.service';

const pme = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'pme@example.gn',
  roles: ['PME'],
  permissions: [],
  entrepriseId: '22222222-2222-4222-8222-222222222222',
};
const pdfBuffer = Buffer.from('%PDF-1.7\nsecure');
const file = {
  buffer: pdfBuffer,
  size: pdfBuffer.length,
  mimetype: 'application/pdf',
  originalname: '../../RCCM final.exe',
} as Express.Multer.File;
// Axe E6 (docs/14-ROADMAP-SAAS-PREMIUM.md) - not configured (the same state as the local demo
// stack and every other test in this file that isn't exercising the scan itself), so `scan()`
// stays a pure pass-through: these existing tests' behaviour is otherwise unchanged by this axis.
const clamavDisabled = { scan: jest.fn().mockResolvedValue({ scanned: false }) };

describe('DocumentsService security', () => {
  it('refuses an upload when the owned application is no longer editable', async () => {
    const repository = {
      findOwnedApplication: jest.fn().mockResolvedValue({ entrepriseId: pme.entrepriseId, statut: 'SOUMIS' }),
    };
    const storage = { upload: jest.fn() };
    const service = new DocumentsService(repository as never, storage as never, clamavDisabled as never);

    await expect(service.uploadOwn(pme, '33333333-3333-4333-8333-333333333333', 'RCCM', file))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('uses a server-generated scoped key and cleans object storage when metadata persistence fails', async () => {
    const repository = {
      findOwnedApplication: jest.fn().mockResolvedValue({ entrepriseId: pme.entrepriseId, statut: 'BROUILLON' }),
      create: jest.fn().mockRejectedValue(new Error('database failure')),
    };
    const storage = { upload: jest.fn(), delete: jest.fn().mockResolvedValue(undefined) };
    const service = new DocumentsService(repository as never, storage as never, clamavDisabled as never);

    await expect(service.uploadOwn(pme, '33333333-3333-4333-8333-333333333333', 'RCCM', file)).rejects.toThrow('database failure');
    const key = storage.upload.mock.calls[0][0] as string;
    expect(key).toMatch(/^companies\/22222222-2222-4222-8222-222222222222\/applications\/33333333-3333-4333-8333-333333333333\/[0-9a-f-]+\.pdf$/);
    expect(key).not.toContain('RCCM');
    expect(repository.create.mock.calls[0][0].nomFichier).toBe('RCCM final.pdf');
    expect(storage.delete).toHaveBeenCalledWith(key);
  });

  it('detects a modified stored object before returning it', async () => {
    const repository = {
      findOwnedById: jest.fn().mockResolvedValue({ storageKey: 'private/key', checksumSha256: 'invalid', nomFichier: 'rccm.pdf' }),
    };
    const storage = { download: jest.fn().mockResolvedValue({ buffer: pdfBuffer, contentType: 'application/pdf' }) };
    const service = new DocumentsService(repository as never, storage as never, clamavDisabled as never);

    await expect(service.downloadOwn(pme, '44444444-4444-4444-8444-444444444444'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('requires an agent comment for rejected or incomplete documents', async () => {
    const service = new DocumentsService({ verify: jest.fn() } as never, {} as never, clamavDisabled as never);
    await expect(service.verify(pme, '44444444-4444-4444-8444-444444444444', 'REJETE'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  // Axe E6 (docs/14-ROADMAP-SAAS-PREMIUM.md) - antivirus scanning.
  it('rejects an upload ClamAV reports as infected, before it ever reaches object storage', async () => {
    const repository = { findOwnedApplication: jest.fn() };
    const storage = { upload: jest.fn() };
    const clamav = { scan: jest.fn().mockResolvedValue({ scanned: true, infected: true, signature: 'Eicar-Test-Signature' }) };
    const service = new DocumentsService(repository as never, storage as never, clamav as never);

    await expect(service.uploadOwn(pme, '33333333-3333-4333-8333-333333333333', 'RCCM', file))
      .rejects.toThrow(/Eicar-Test-Signature/);
    expect(repository.findOwnedApplication).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('accepts an upload ClamAV reports clean', async () => {
    const repository = {
      findOwnedApplication: jest.fn().mockResolvedValue({ entrepriseId: pme.entrepriseId, statut: 'BROUILLON' }),
      create: jest.fn().mockResolvedValue(undefined),
      findOwnedById: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    };
    const storage = { upload: jest.fn().mockResolvedValue(undefined) };
    const clamav = { scan: jest.fn().mockResolvedValue({ scanned: true, infected: false }) };
    const service = new DocumentsService(repository as never, storage as never, clamav as never);

    await expect(service.uploadOwn(pme, '33333333-3333-4333-8333-333333333333', 'RCCM', file)).resolves.toEqual({ id: 'doc-1' });
    expect(storage.upload).toHaveBeenCalled();
  });

  it('fails closed (503), not open, when ClamAV is configured but unreachable', async () => {
    const repository = { findOwnedApplication: jest.fn() };
    const storage = { upload: jest.fn() };
    const clamav = { scan: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) };
    const service = new DocumentsService(repository as never, storage as never, clamav as never);

    await expect(service.uploadOwn(pme, '33333333-3333-4333-8333-333333333333', 'RCCM', file))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
