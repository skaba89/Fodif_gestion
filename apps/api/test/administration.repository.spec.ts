import { ConfigService } from '@nestjs/config';
import { AdministrationRepository } from '../src/administration/administration.repository';
import { decryptWithKey, deriveSecret, encryptWithKey } from '../src/security-policy';

// Axe B5 (docs/14-ROADMAP-SAAS-PREMIUM.md): utilisateurs.telephone is encrypted at rest
// (AES-256-GCM, see security-policy.js) rather than stored as plaintext. Every other repository
// in this codebase is exercised only through the Docker-based e2e suite (SQL in, SQL out, nothing
// to unit-test) - this one earns a direct spec because it now has real application logic (encrypt
// before the INSERT, decrypt after the SELECT) worth isolating from a live database.
const JWT_SECRET = 'a-test-only-jwt-secret-at-least-32-chars-long';
const config = { get: (key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : 'test') } as unknown as ConfigService;
// The key AdministrationRepository derives internally - used here only to assert against
// ciphertext it produced, never to bypass the repository's own encryption.
const expectedKey = deriveSecret(JWT_SECRET, 'fodip-pii-telephone-encryption-v1');

describe('AdministrationRepository (axe B5 - telephone encryption at rest)', () => {
  it('decrypts telephone on listUsers, leaving accounts with no telephone as null', async () => {
    const encrypted = encryptWithKey('+224622000000', expectedKey);
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { id: 'u1', email: 'a@fodip.local', telephone: encrypted },
          { id: 'u2', email: 'b@fodip.local', telephone: null },
        ],
        rowCount: 2,
      }),
    };
    const repository = new AdministrationRepository(db as never, config);

    const result = await repository.listUsers();

    expect(result.items[0].telephone).toBe('+224622000000');
    expect(result.items[1].telephone).toBeNull();
    // Never persisted or returned as plaintext by the query layer itself.
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('utilisateur.telephone'), [null]);
  });

  it('encrypts telephone before the INSERT on create, and stores null when none is provided', async () => {
    const insertCalls: unknown[][] = [];
    const client = {
      query: jest.fn((text: string, values: unknown[] = []) => {
        if (text.includes('SELECT id FROM roles')) return { rows: [{ id: 'role-1' }], rowCount: 1 };
        if (text.includes('INSERT INTO utilisateurs')) { insertCalls.push(values); return { rows: [{ id: 'new-user' }] }; }
        return { rows: [], rowCount: 0 };
      }),
    };
    const db = { transaction: (callback: (client: unknown) => unknown) => callback(client) };
    const repository = new AdministrationRepository(db as never, config);

    await repository.create('actor-1', {
      email: 'new@fodip.local', nom: 'Test', telephone: '+224622111111', passwordHash: 'hash',
      roles: ['AGENT_FODIP'], mfaRequired: false,
    });

    expect(insertCalls).toHaveLength(1);
    const telephoneParam = insertCalls[0][3] as string;
    expect(telephoneParam).not.toBe('+224622111111');
    expect(decryptWithKey(telephoneParam, expectedKey)).toBe('+224622111111');

    await repository.create('actor-1', {
      email: 'no-phone@fodip.local', nom: 'Test', passwordHash: 'hash', roles: ['AGENT_FODIP'], mfaRequired: false,
    });
    expect(insertCalls[1][3]).toBeNull();
  });
});
