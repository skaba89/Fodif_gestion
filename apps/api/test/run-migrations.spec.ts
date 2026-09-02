import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyFiles, listSqlFiles, shouldUseSsl } from '../scripts/run-migrations.js';

describe('shouldUseSsl', () => {
  it('disables SSL for localhost connections (matches DatabaseService)', () => {
    expect(shouldUseSsl('postgresql://user:pass@localhost:5432/db')).toBe(false);
    expect(shouldUseSsl('postgresql://user:pass@127.0.0.1:5432/db')).toBe(false);
  });

  it('enables SSL for a hosted connection (Neon, Supabase, ...)', () => {
    expect(shouldUseSsl('postgresql://user:pass@ep-cool-thing.eu-central-1.aws.neon.tech/db')).toBe(true);
  });
});

describe('listSqlFiles', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fodip-migrations-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns numbered SQL files in ascending order', () => {
    writeFileSync(join(dir, '002_second.sql'), '-- second');
    writeFileSync(join(dir, '001_first.sql'), '-- first');
    writeFileSync(join(dir, 'README.md'), 'not sql');
    writeFileSync(join(dir, 'seed.sql'), '-- not numbered, ignored');

    const files = listSqlFiles(dir);
    expect(files.map((file) => file.split('/').pop())).toEqual(['001_first.sql', '002_second.sql']);
  });

  it('returns an empty list for a directory that does not exist', () => {
    expect(listSqlFiles(join(dir, 'missing'))).toEqual([]);
  });
});

describe('applyFiles', () => {
  it('runs each file through the client in order, in a single query call per file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fodip-migrations-'));
    try {
      writeFileSync(join(dir, '001_a.sql'), 'CREATE TABLE a ();');
      writeFileSync(join(dir, '002_b.sql'), 'CREATE TABLE b ();');
      const files = listSqlFiles(dir);

      const calls: string[] = [];
      const client = { query: jest.fn(async (sql: string) => { calls.push(sql); }) };

      await applyFiles(client as never, files, () => undefined);

      expect(client.query).toHaveBeenCalledTimes(2);
      expect(calls).toEqual(['CREATE TABLE a ();', 'CREATE TABLE b ();']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
