import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyFiles, applyMigrations, checksumOf, listSqlFiles, shouldUseSsl, versionOf } from '../scripts/run-migrations.js';

describe('shouldUseSsl', () => {
  it('disables SSL for localhost connections (matches DatabaseService)', () => {
    expect(shouldUseSsl('postgresql://user:pass@localhost:5432/db')).toBe(false);
    expect(shouldUseSsl('postgresql://user:pass@127.0.0.1:5432/db')).toBe(false);
  });

  it('enables SSL for a hosted connection (Neon, Supabase, ...)', () => {
    expect(shouldUseSsl('postgresql://user:pass@ep-cool-thing.eu-central-1.aws.neon.tech/db')).toBe(true);
  });

  // docker-compose's `migrations` service connects to hostname `postgres`, not `localhost` -
  // without this override it would wrongly enable SSL against a container that doesn't speak it.
  it('an explicit DATABASE_SSL overrides the hostname heuristic in either direction', () => {
    expect(shouldUseSsl('postgresql://user:pass@postgres:5432/db', 'false')).toBe(false);
    expect(shouldUseSsl('postgresql://user:pass@localhost:5432/db', 'true')).toBe(true);
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

describe('checksumOf / versionOf', () => {
  it('is a stable SHA-256 hex digest, sensitive to any content change', () => {
    const checksum = checksumOf('CREATE TABLE a ();');
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(checksumOf('CREATE TABLE a ();')).toBe(checksum);
    expect(checksumOf('CREATE TABLE a (); -- trailing comment')).not.toBe(checksum);
  });

  it('extracts the 3-digit version prefix and rejects an unversioned filename', () => {
    expect(versionOf('/repo/database/007_financing_operations.sql')).toBe('007');
    expect(() => versionOf('/repo/database/README.md')).toThrow();
  });
});

/**
 * In-memory stand-in for `pg.Client`, just enough of it to exercise applyMigrations' own control
 * flow (which SQL it issues, in what order, and how it reacts to what comes back) without a real
 * Postgres - the exact same "real black box, fake only the driver" split as apps/api/test's other
 * mocked-repository specs. What this can't prove - that pg_try_advisory_lock genuinely serializes
 * two real concurrent processes, and that ROLLBACK genuinely undoes DDL already sent to a real
 * server - is covered instead by test/integration/run-migrations.integration-spec.ts against a
 * real PostgreSQL.
 */
class FakeMigrationsClient {
  private locked = false;
  private readonly migrations = new Map<string, { checksum: string; success: boolean }>();
  readonly queries: string[] = [];
  failOn?: string;

  async query(sql: string, params: unknown[] = []): Promise<{ rows: Array<Record<string, unknown>> }> {
    const trimmed = sql.trim();
    this.queries.push(trimmed);

    if (trimmed.startsWith('SELECT pg_try_advisory_lock')) {
      if (this.locked) return { rows: [{ locked: false }] };
      this.locked = true;
      return { rows: [{ locked: true }] };
    }
    if (trimmed.startsWith('SELECT pg_advisory_unlock')) {
      this.locked = false;
      return { rows: [] };
    }
    if (trimmed.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      return { rows: [] };
    }
    if (trimmed.startsWith('SELECT version, checksum FROM schema_migrations')) {
      const applied = [...this.migrations.entries()].filter(([, row]) => row.success);
      return { rows: applied.map(([version, row]) => ({ version, checksum: row.checksum })) };
    }
    if (trimmed.startsWith('INSERT INTO schema_migrations')) {
      const [version, , checksum, , success] = params as [string, string, string, number, boolean];
      this.migrations.set(version, { checksum, success });
      return { rows: [] };
    }
    if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      return { rows: [] };
    }
    if (this.failOn && trimmed.includes(this.failOn)) {
      throw new Error(`simulated failure executing: ${trimmed}`);
    }
    return { rows: [] }; // the migration file's own DDL/DML
  }
}

function writeMigration(dir: string, filename: string, sql: string) {
  writeFileSync(join(dir, filename), sql);
}

describe('applyMigrations', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fodip-migrations-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('applies every unapplied file in order and records a success row with its checksum', async () => {
    writeMigration(dir, '001_a.sql', 'CREATE TABLE a ();');
    writeMigration(dir, '002_b.sql', 'CREATE TABLE b ();');
    const client = new FakeMigrationsClient();

    await applyMigrations(client as never, listSqlFiles(dir), () => undefined);

    const inserts = client.queries.filter((q) => q.startsWith('INSERT INTO schema_migrations'));
    expect(inserts).toHaveLength(2);
    expect(client.queries.filter((q) => q === 'BEGIN')).toHaveLength(2);
    expect(client.queries.filter((q) => q === 'COMMIT')).toHaveLength(2);
  });

  it('skips a migration already applied with an unchanged checksum - never re-sends its SQL', async () => {
    writeMigration(dir, '001_a.sql', 'CREATE TABLE a ();');
    const client = new FakeMigrationsClient();

    await applyMigrations(client as never, listSqlFiles(dir), () => undefined);
    const queriesAfterFirstRun = client.queries.length;
    await applyMigrations(client as never, listSqlFiles(dir), () => undefined);

    // Second run: lock, ensure-table, select-applied, unlock - and nothing else. In particular no
    // second BEGIN/INSERT for version 001, and never a second execution of "CREATE TABLE a ();".
    expect(client.queries.length).toBeGreaterThan(queriesAfterFirstRun); // the lock/select bookkeeping still runs
    expect(client.queries.filter((q) => q === 'CREATE TABLE a ();')).toHaveLength(1);
    expect(client.queries.filter((q) => q === 'BEGIN')).toHaveLength(1);
  });

  it('refuses a migration whose content changed since it was applied - checksum mismatch, not a silent re-run', async () => {
    writeMigration(dir, '001_a.sql', 'CREATE TABLE a ();');
    const client = new FakeMigrationsClient();
    await applyMigrations(client as never, listSqlFiles(dir), () => undefined);

    writeMigration(dir, '001_a.sql', 'CREATE TABLE a (id INT); -- edited after the fact');

    await expect(applyMigrations(client as never, listSqlFiles(dir), () => undefined)).rejects.toThrow(/checksum/i);
  });

  it('rolls back and records a failure row when a migration errors - the run stops immediately', async () => {
    writeMigration(dir, '001_a.sql', 'CREATE TABLE a ();');
    writeMigration(dir, '002_broken.sql', 'THIS IS NOT VALID SQL');
    writeMigration(dir, '003_c.sql', 'CREATE TABLE c ();');
    const client = new FakeMigrationsClient();
    client.failOn = 'THIS IS NOT VALID SQL';

    await expect(applyMigrations(client as never, listSqlFiles(dir), () => undefined)).rejects.toThrow(/simulated failure/);

    expect(client.queries).toContain('ROLLBACK');
    // 003 never runs: the failure on 002 stops the loop immediately.
    expect(client.queries.filter((q) => q === 'CREATE TABLE c ();')).toHaveLength(0);
    // Two bookkeeping inserts: 001's success, then 002's failure - 003 never reaches this point.
    const inserts = client.queries.filter((q) => q.startsWith('INSERT INTO schema_migrations'));
    expect(inserts).toHaveLength(2);
  });

  it('refuses to run when another run already holds the advisory lock', async () => {
    writeMigration(dir, '001_a.sql', 'CREATE TABLE a ();');
    const client = new FakeMigrationsClient();
    // Simulate a concurrent holder by taking the lock directly, the same way applyMigrations itself does.
    await client.query('SELECT pg_try_advisory_lock($1) AS locked', ['irrelevant-here']);

    await expect(applyMigrations(client as never, listSqlFiles(dir), () => undefined)).rejects.toThrow(/already holds the advisory lock/);
  });
});
