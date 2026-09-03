/**
 * Real-PostgreSQL integration coverage for the versioned/checksummed/locked migration runner
 * (Sprint Enterprise 0, "niveau 80-85/100" mission, axe fondations P0 4.4 -
 * apps/api/scripts/run-migrations.js). test/run-migrations.spec.ts exercises the same control
 * flow against a fake in-memory client - useful for the exact SQL/order it issues, but
 * structurally unable to prove the two things that only mean something against a real server: that
 * `pg_try_advisory_lock` genuinely serializes two concurrent real connections, and that a real
 * `ROLLBACK` genuinely undoes DDL already sent to the server rather than merely stopping the
 * process. This spec starts a disposable Postgres (the same escape hatch as
 * support/database.ts's TEST_DATABASE_URL) and, unlike every other integration spec here, resets
 * to a genuinely *empty* schema between tests (`DROP SCHEMA public CASCADE`) rather than applying
 * migrations once and truncating data - the whole point here is exercising the mechanism that
 * applies migrations in the first place, from a clean slate every time.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from 'pg';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { applyMigrations, listSqlFiles } from '../../scripts/run-migrations.js';

const POSTGRES_IMAGE = 'postgres:16.10-alpine'; // kept in sync with support/database.ts's own note - see there for why

function resolveDatabaseDir(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', '..', 'database'),
    path.resolve(process.cwd(), '..', '..', 'database'),
    path.resolve(process.cwd(), 'database'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Could not locate the database/ migrations directory (tried: ${candidates.join(', ')})`);
  return found;
}

describe('Migration runner (real PostgreSQL)', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let connectionUri: string;
  let client: Client;

  beforeAll(async () => {
    const externalUrl = process.env.TEST_DATABASE_URL;
    container = externalUrl
      ? undefined
      : await new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase('fodip_migrations_test').withUsername('fodip_migrations_test').withPassword('fodip_migrations_test').start();
    connectionUri = externalUrl ?? container!.getConnectionUri();
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  beforeEach(async () => {
    client = new Client({ connectionString: connectionUri });
    await client.connect();
    // Genuinely empty schema for every test - not just TRUNCATE, since schema_migrations and
    // whatever tables the test's own migrations create must not survive between cases either.
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });

  afterEach(async () => {
    await client.end();
  });

  function tempMigrationsDir(): string {
    return mkdtempSync(path.join(tmpdir(), 'fodip-migrations-it-'));
  }

  it('applies every real database/*.sql migration from scratch, recording a matching checksum for each', async () => {
    const databaseDir = resolveDatabaseDir();
    const files = listSqlFiles(databaseDir);
    expect(files.length).toBeGreaterThan(0); // sanity: the real migrations directory was actually found

    const log: string[] = [];
    await applyMigrations(client, files, (line: string) => log.push(line));

    const { rows } = await client.query('SELECT version, filename, checksum, success FROM schema_migrations ORDER BY version');
    expect(rows).toHaveLength(files.length);
    expect(rows.every((row) => row.success)).toBe(true);

    for (const [i, file] of files.entries()) {
      const expectedChecksum = createHash('sha256').update(readFileSync(file, 'utf8'), 'utf8').digest('hex');
      expect(rows[i].checksum).toBe(expectedChecksum);
      expect(rows[i].filename).toBe(path.basename(file));
    }

    // A representative real table from the real schema actually landed, not just bookkeeping rows.
    const { rows: tableCheck } = await client.query(
      `SELECT to_regclass('public.utilisateurs') AS table_oid`,
    );
    expect(tableCheck[0].table_oid).not.toBeNull();
  });

  it('re-running is a genuine no-op: every file is skipped, none re-executed', async () => {
    const databaseDir = resolveDatabaseDir();
    const files = listSqlFiles(databaseDir);

    await applyMigrations(client, files, () => undefined);
    const firstRunCount = (await client.query('SELECT COUNT(*) AS n FROM schema_migrations')).rows[0].n;

    const secondRunLog: string[] = [];
    await applyMigrations(client, files, (line: string) => secondRunLog.push(line));

    const secondRunCount = (await client.query('SELECT COUNT(*) AS n FROM schema_migrations')).rows[0].n;
    expect(secondRunCount).toBe(firstRunCount);
    expect(secondRunLog.every((line) => line.includes('already applied'))).toBe(true);
    expect(secondRunLog).toHaveLength(files.length);
  });

  it('N-1 upgrade path: applying an already-partially-migrated database only runs the newly added migration', async () => {
    const dir = tempMigrationsDir();
    try {
      writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE a (id INT);');
      writeFileSync(path.join(dir, '002_b.sql'), 'CREATE TABLE b (id INT);');
      await applyMigrations(client, listSqlFiles(dir), () => undefined); // simulates "database already at N-1"

      writeFileSync(path.join(dir, '003_c.sql'), 'CREATE TABLE c (id INT);'); // the new migration, as if just added to the repo
      const log: string[] = [];
      await applyMigrations(client, listSqlFiles(dir), (line: string) => log.push(line));

      expect(log).toEqual([
        'Skipping 001_a.sql (already applied, checksum unchanged)',
        'Skipping 002_b.sql (already applied, checksum unchanged)',
        'Applying 003_c.sql',
      ]);
      for (const table of ['a', 'b', 'c']) {
        const { rows } = await client.query(`SELECT to_regclass('public.${table}') AS table_oid`);
        expect(rows[0].table_oid).not.toBeNull();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects a migration edited after it was already applied - refuses rather than silently re-running it', async () => {
    const dir = tempMigrationsDir();
    try {
      writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE a (id INT);');
      await applyMigrations(client, listSqlFiles(dir), () => undefined);

      writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE a (id INT); -- edited after the fact, same version');
      await expect(applyMigrations(client, listSqlFiles(dir), () => undefined)).rejects.toThrow(/checksum/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a failing statement rolls back its whole migration file - no partial DDL from that file survives', async () => {
    const dir = tempMigrationsDir();
    try {
      // Two statements in one file: the first would succeed on its own, the second is invalid -
      // real transactional rollback means neither survives, not just that the process stopped.
      writeFileSync(path.join(dir, '001_partial.sql'), 'CREATE TABLE should_not_survive (id INT);\nTHIS IS NOT VALID SQL;');

      await expect(applyMigrations(client, listSqlFiles(dir), () => undefined)).rejects.toThrow();

      const { rows } = await client.query(`SELECT to_regclass('public.should_not_survive') AS table_oid`);
      expect(rows[0].table_oid).toBeNull(); // real proof of rollback, not an assumption

      const { rows: recorded } = await client.query('SELECT version, success FROM schema_migrations');
      expect(recorded).toEqual([{ version: '001', success: false }]); // the failed attempt is recorded as such, not silently dropped
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('two concurrent runs against the same database: exactly one proceeds, the other fails fast on the advisory lock', async () => {
    const dir = tempMigrationsDir();
    try {
      writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE a (id INT);');
      const files = listSqlFiles(dir);

      // A second, independent real connection - applyMigrations takes pg_try_advisory_lock itself
      // on whichever client it's given, so two real sessions genuinely contend for it here.
      const secondClient = new Client({ connectionString: connectionUri });
      await secondClient.connect();
      try {
        const results = await Promise.allSettled([
          applyMigrations(client, files, () => undefined),
          applyMigrations(secondClient, files, () => undefined),
        ]);

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(String(rejected[0].reason)).toMatch(/already holds the advisory lock/);

        const { rows } = await client.query('SELECT COUNT(*) AS n FROM schema_migrations WHERE success = TRUE');
        expect(Number(rows[0].n)).toBe(1); // applied exactly once, not twice, not zero
      } finally {
        await secondClient.end();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
