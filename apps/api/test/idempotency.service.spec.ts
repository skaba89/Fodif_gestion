import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { IdempotencyService } from '../src/common/idempotency.service';

function makeDb(queryImpl: (sql: string, values: unknown[]) => Promise<{ rows: unknown[] }>) {
  return { query: jest.fn(queryImpl) };
}

describe('IdempotencyService', () => {
  it('calls the handler directly and never touches the database when no key is given', async () => {
    const db = makeDb(async () => { throw new Error('should not be called'); });
    const service = new IdempotencyService(db as never);
    const handler = jest.fn().mockResolvedValue({ ok: true });

    await expect(service.run('scope.a', undefined, 'user-1', { montant: 10 }, handler)).resolves.toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('runs the handler and stores its result when the key claim is won (INSERT ... RETURNING id)', async () => {
    const db = makeDb(async (sql) => {
      if (sql.startsWith('INSERT INTO idempotency_keys')) return { rows: [{ id: 'claim-1' }] };
      if (sql.startsWith('UPDATE idempotency_keys')) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const service = new IdempotencyService(db as never);
    const handler = jest.fn().mockResolvedValue({ id: 'financing-1' });

    const result = await service.run('financings.plan_disbursement', 'key-1', 'user-1', { montant: 500 }, handler);

    expect(result).toEqual({ id: 'financing-1' });
    expect(handler).toHaveBeenCalledTimes(1);
    const updateCall = db.query.mock.calls.find(([sql]) => (sql as string).startsWith('UPDATE idempotency_keys'));
    expect(updateCall?.[1]).toEqual(['claim-1', JSON.stringify({ id: 'financing-1' })]);
  });

  it('replays the stored response instead of re-running the handler when the same key and payload are reused', async () => {
    const payload = { montant: 500 };
    const requestHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const db = makeDb(async (sql) => {
      if (sql.startsWith('INSERT INTO idempotency_keys')) return { rows: [] }; // lost the race - already claimed
      if (sql.startsWith('SELECT')) {
        return { rows: [{ requestHash, responseBody: { id: 'financing-1', replayed: true } }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const service = new IdempotencyService(db as never);
    const handler = jest.fn().mockResolvedValue({ id: 'should-never-be-returned' });

    const result = await service.run('financings.plan_disbursement', 'key-1', 'user-1', payload, handler);

    expect(result).toEqual({ id: 'financing-1', replayed: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the same key is reused with a genuinely different payload', async () => {
    const db = makeDb(async (sql) => {
      if (sql.startsWith('INSERT INTO idempotency_keys')) return { rows: [] };
      if (sql.startsWith('SELECT')) return { rows: [{ requestHash: 'a-different-hash', responseBody: { id: 'f1' } }] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const service = new IdempotencyService(db as never);
    const handler = jest.fn();

    await expect(service.run('financings.plan_disbursement', 'key-1', 'user-1', { montant: 999 }, handler))
      .rejects.toBeInstanceOf(ConflictException);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the same key is still mid-flight (claim exists, no completed response yet)', async () => {
    const db = makeDb(async (sql) => {
      if (sql.startsWith('INSERT INTO idempotency_keys')) return { rows: [] };
      if (sql.startsWith('SELECT')) return { rows: [] }; // WHERE statut_reponse IS NOT NULL excludes the in-flight claim
      throw new Error(`unexpected query: ${sql}`);
    });
    const service = new IdempotencyService(db as never);
    const handler = jest.fn();

    await expect(service.run('financings.plan_disbursement', 'key-1', 'user-1', { montant: 999 }, handler))
      .rejects.toBeInstanceOf(ConflictException);
    expect(handler).not.toHaveBeenCalled();
  });

  it('deletes the claim and stays retryable when the handler itself fails', async () => {
    const db = makeDb(async (sql) => {
      if (sql.startsWith('INSERT INTO idempotency_keys')) return { rows: [{ id: 'claim-1' }] };
      if (sql.startsWith('DELETE FROM idempotency_keys')) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const service = new IdempotencyService(db as never);
    const handler = jest.fn().mockRejectedValue(new Error('validation failed'));

    await expect(service.run('financings.plan_disbursement', 'key-1', 'user-1', { montant: 999 }, handler))
      .rejects.toThrow('validation failed');
    const deleteCall = db.query.mock.calls.find(([sql]) => (sql as string).startsWith('DELETE FROM idempotency_keys'));
    expect(deleteCall?.[1]).toEqual(['claim-1']);
  });
});
