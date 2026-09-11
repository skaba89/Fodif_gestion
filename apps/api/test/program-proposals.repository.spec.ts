import { ConflictException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../src/database/database.service';
import { ProgramProposalsRepository } from '../src/programs/program-proposals.repository';

describe('ProgramProposalsRepository', () => {
  let dbQuery: jest.Mock;
  let transaction: jest.Mock;
  let clientQuery: jest.Mock;
  let repository: ProgramProposalsRepository;

  beforeEach(() => {
    dbQuery = jest.fn();
    clientQuery = jest.fn();
    transaction = jest.fn(async (work: (client: PoolClient) => Promise<unknown>) => work({ query: clientQuery } as unknown as PoolClient));
    repository = new ProgramProposalsRepository({ query: dbQuery, transaction } as unknown as DatabaseService);
  });

  it('returns the default region and sector reference lists', async () => {
    dbQuery
      .mockResolvedValueOnce({ rows: [{ id: 'r1', code: 'CONAKRY', nom: 'Conakry' }] })
      .mockResolvedValueOnce({ rows: [{ id: 's1', code: 'AGRICULTURE', nom: 'Agriculture' }] });

    await expect(repository.references()).resolves.toEqual({
      regions: [{ id: 'r1', code: 'CONAKRY', nom: 'Conakry' }],
      secteurs: [{ id: 's1', code: 'AGRICULTURE', nom: 'Agriculture' }],
    });
    expect(dbQuery).toHaveBeenCalledTimes(2);
  });

  it('lists only proposals belonging to the authenticated actor', async () => {
    dbQuery.mockResolvedValue({ rows: [{ id: 'p1', code: 'PROP-1', workflowStatus: 'BROUILLON' }] });
    await expect(repository.listOwn('actor-1')).resolves.toEqual([{ id: 'p1', code: 'PROP-1', workflowStatus: 'BROUILLON' }]);
    expect(dbQuery.mock.calls[0][1]).toEqual(['actor-1']);
  });

  it('creates a scoped draft, checklist and audit trail atomically', async () => {
    const getOwn = jest.spyOn(repository, 'getOwn').mockResolvedValue({ id: 'program-1', code: 'PROP-1' } as never);
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*)::int AS count FROM regions')) return { rows: [{ count: 1 }] };
      if (sql.includes('COUNT(*)::int AS count FROM secteurs_activite')) return { rows: [{ count: 1 }] };
      if (sql.includes('INSERT INTO programmes_fodip')) return { rows: [{ id: 'program-1' }] };
      if (sql.includes('INSERT INTO programme_regles_versions')) return { rows: [{ id: 'version-1' }] };
      return { rows: [] };
    });

    const result = await repository.create('actor-1', {
      code: 'prop-1',
      nom: 'Programme proposé',
      montantMin: 100,
      montantMax: 500,
      apportMinPct: 10,
      rccmRequis: true,
      regionIds: ['11111111-1111-4111-8111-111111111111'],
      secteurIds: ['22222222-2222-4222-8222-222222222222'],
      documents: [{ code: 'RCCM', libelle: 'RCCM', typeDocument: 'RCCM', obligatoire: true }],
    });

    expect(result).toEqual({ id: 'program-1', code: 'PROP-1' });
    expect(getOwn).toHaveBeenCalledWith('actor-1', 'program-1');
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO programme_regions'))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO programme_secteurs'))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('PROGRAM_PROPOSAL_CREATED'))).toBe(false);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO audit_logs'))).toBe(true);
  });

  it('rejects inconsistent proposal amounts before opening a transaction', async () => {
    await expect(repository.create('actor-1', {
      code: 'INVALID',
      nom: 'Programme invalide',
      montantMin: 500,
      montantMax: 100,
    })).rejects.toThrow(/montant minimal/i);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('maps a duplicate programme code to a business conflict', async () => {
    transaction.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
    await expect(repository.create('actor-1', { code: 'DUPLICATE', nom: 'Doublon' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('locks a proposal for the maker after hierarchical submission', async () => {
    clientQuery.mockResolvedValueOnce({
      rows: [{ id: 'program-1', statut: 'BROUILLON', submitted_at: new Date().toISOString() }],
    });
    await expect(repository.update('actor-1', 'program-1', { nom: 'Modification tardive' })).rejects.toThrow(/soumise/i);
  });

  it('submits an owned draft to Direction and returns its refreshed state', async () => {
    const getOwn = jest.spyOn(repository, 'getOwn').mockResolvedValue({ id: 'program-1', versions: [{ submittedAt: 'now' }] } as never);
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT v.*')) return { rows: [{ id: 'version-1', statut: 'BROUILLON', submitted_at: null }] };
      return { rows: [] };
    });

    const result = await repository.submit('actor-1', 'program-1', 1);
    expect(result).toEqual({ id: 'program-1', versions: [{ submittedAt: 'now' }] });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('submitted_by'))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO audit_logs'))).toBe(true);
    expect(getOwn).toHaveBeenCalledWith('actor-1', 'program-1');
  });
});
