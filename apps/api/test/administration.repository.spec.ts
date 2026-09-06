import { ConfigService } from '@nestjs/config';
import { AdministrationRepository } from '../src/administration/administration.repository';
import { decryptWithKey, deriveSecret, encryptWithKey } from '../src/security-policy';

// Axe B5 (docs/14-ROADMAP-SAAS-PREMIUM.md): utilisateurs.telephone is encrypted at rest
// (AES-256-GCM, see security-policy.js) rather than stored as plaintext.
const JWT_SECRET = 'a-test-only-jwt-secret-at-least-32-chars-long';
const config = { get: (key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : 'test') } as unknown as ConfigService;
const expectedKey = deriveSecret(JWT_SECRET, 'fodip-pii-telephone-encryption-v1');

describe('AdministrationRepository', () => {
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

  it('creates enterprise and partner bank inside audited transactions', async () => {
    const queries: Array<{ text: string; values: unknown[] }> = [];
    const client = {
      query: jest.fn((text: string, values: unknown[] = []) => {
        queries.push({ text, values });
        if (text.includes('INSERT INTO entreprises')) {
          return { rows: [{ id: 'enterprise-1', codeFodip: 'PME-001', raisonSociale: 'PME Exemple' }] };
        }
        if (text.includes('INSERT INTO partenaires_bancaires')) {
          return { rows: [{ id: 'bank-1', code: 'BANK-01', raisonSociale: 'Banque Exemple' }] };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const db = { transaction: (callback: (client: unknown) => unknown) => callback(client) };
    const repository = new AdministrationRepository(db as never, config);

    const enterprise = await repository.createEnterprise('actor-1', {
      codeFodip: 'PME-001', raisonSociale: 'PME Exemple', nomCommercial: 'Exemple',
    });
    const partnerBank = await repository.createPartnerBank('actor-1', {
      code: 'BANK-01', raisonSociale: 'Banque Exemple',
    });

    expect(enterprise).toEqual({ id: 'enterprise-1', codeFodip: 'PME-001', raisonSociale: 'PME Exemple' });
    expect(partnerBank).toEqual({ id: 'bank-1', code: 'BANK-01', raisonSociale: 'Banque Exemple' });
    expect(queries.some(({ text }) => text.includes("'CREATE_ENTERPRISE'"))).toBe(true);
    expect(queries.some(({ text }) => text.includes("'CREATE_PARTNER_BANK'"))).toBe(true);
    expect(queries.some(({ text }) => text.includes("'ENTREPRISE'"))).toBe(true);
    expect(queries.some(({ text }) => text.includes("'PARTENAIRE_BANCAIRE'"))).toBe(true);
  });
});
