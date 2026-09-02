import { ConfigService } from '@nestjs/config';
import { DataRightsRepository } from '../src/data-rights/data-rights.repository';
import { deriveSecret, encryptWithKey } from '../src/security-policy';

// Axe B5: exportProfile() must decrypt utilisateurs.telephone with the exact same derived key
// AdministrationRepository encrypts it with (same base secret, same HMAC context) - see
// administration.repository.spec.ts for the write side of this same round-trip.
const JWT_SECRET = 'a-test-only-jwt-secret-at-least-32-chars-long';
const config = { get: (key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : 'test') } as unknown as ConfigService;
const piiKey = deriveSecret(JWT_SECRET, 'fodip-pii-telephone-encryption-v1');

describe('DataRightsRepository (axe B5 - telephone decryption on export)', () => {
  it('decrypts an encrypted telephone and leaves a missing one as null', async () => {
    const encrypted = encryptWithKey('+224622000000', piiKey);
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'a@fodip.local', telephone: encrypted }] })
        .mockResolvedValueOnce({ rows: [{ id: 'u2', email: 'b@fodip.local', telephone: null }] }),
    };
    const repository = new DataRightsRepository(db as never, config);

    const withPhone = await repository.exportProfile('u1');
    const withoutPhone = await repository.exportProfile('u2');

    expect(withPhone?.telephone).toBe('+224622000000');
    expect(withoutPhone?.telephone).toBeNull();
  });

  it('returns null for a profile that no longer exists, without attempting to decrypt', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new DataRightsRepository(db as never, config);
    await expect(repository.exportProfile('missing')).resolves.toBeNull();
  });
});
