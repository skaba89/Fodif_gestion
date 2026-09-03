/**
 * Real-PostgreSQL test harness for Sprint Enterprise 0, Lot 2 (axe E2 -
 * docs/14-ROADMAP-SAAS-PREMIUM.md). The repository's existing `test/*.spec.ts` suite exercises
 * services against hand-written repository mocks only - useful for branch coverage, but unable to
 * catch anything that depends on real Postgres behaviour: row locking (`FOR UPDATE`), unique
 * constraint conflicts, or genuinely concurrent requests racing each other. This harness starts a
 * disposable `postgres:16.10-alpine` container (the exact image docker-compose.yml pins for the
 * `postgres` service) via Testcontainers, applies the real database/*.sql migrations against it,
 * and hands back a `DatabaseService` wired to it - the same class production code uses - so
 * integration specs exercise the real repository/service classes unmodified.
 *
 * One container is started per test file (in `beforeAll`), not per test case: container startup
 * takes several seconds, and `resetDatabase` between tests (TRUNCATE ... CASCADE) is fast and
 * gives each test a clean slate without paying that cost repeatedly.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Client, Pool } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DatabaseService } from '../../../src/database/database.service';

// docker-compose.yml's `postgres` service image - kept in sync manually since it isn't imported
// from anywhere: if that pin changes, update this one too so integration tests exercise the same
// engine version production runs on.
const POSTGRES_IMAGE = 'postgres:16.10-alpine';

function resolveDatabaseDir(): string {
  // apps/api/test/integration/support -> repo root is 4 levels up, but this is resolved
  // defensively (rather than hard-coded) since it must survive both `pnpm --filter @fodip/api
  // test:integration` (cwd = apps/api) and a plain `jest` invocation from an IDE (cwd varies).
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', '..', 'database'),
    path.resolve(process.cwd(), '..', '..', 'database'),
    path.resolve(process.cwd(), 'database'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Could not locate the database/ migrations directory (tried: ${candidates.join(', ')})`);
  }
  return found;
}

function migrationFiles(): string[] {
  const dir = resolveDatabaseDir();
  return readdirSync(dir)
    .filter((name) => /^\d{3}_.*\.sql$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

// Tables the migrations themselves seed once via INSERT (grep '^INSERT INTO' database/*.sql -
// confirmed exhaustive) and application code never writes to (grep for INTO/UPDATE/DELETE against
// each across apps/api/src - zero matches): fixed reference data the schema owns, not per-test
// fixtures. reset() must never wipe these, or the very first beforeEach in any spec file empties
// the roles table - a real bug this comment exists because of (caught the hard way: an
// administration integration spec's "unknown role" fixture silently matched zero roles instead of
// the real ones, and a "last SUPER_ADMIN" guard test passed for the wrong reason - the seeded
// SUPER_ADMIN role was gone, not correctly protected).
const SEED_ONLY_TABLES = new Set(['roles', 'permissions', 'role_permissions']);

export interface IntegrationDatabase {
  /** The production `DatabaseService`, wired to the disposable container - use this to exercise repositories/services. */
  db: DatabaseService;
  /** Raw `pg` pool for fixture setup and assertions the repository layer doesn't expose. */
  pool: Pool;
  /**
   * Wipes every test-owned table's rows (structure kept) so the next test starts from a clean
   * slate - except SEED_ONLY_TABLES (roles, permissions, role_permissions), migration-seeded
   * reference data that must survive every reset exactly as the real schema provides it.
   */
  reset(): Promise<void>;
  /** Stops the pool and the container. Call once in `afterAll`. */
  stop(): Promise<void>;
}

/**
 * True end-to-end coverage for the mission's own real-Postgres proof - a migration that evolves a
 * view an *earlier* migration also defines (analytics.vw_financing_performance: created by 006,
 * extended by 014, mission "présentation Directeur général") surfaced two real gaps here, neither
 * theoretical:
 *   1. PostgreSQL's CREATE OR REPLACE VIEW can add columns but never drop or reorder them - a
 *      second full migration replay against a database an *earlier* call already carried through
 *      014 tries to shrink the view back down when it re-runs 006, and fails ("cannot drop
 *      columns from view"). Testcontainers never hits this (each spec file gets a brand-new
 *      container - a full replay only ever happens once, against nothing); this sandbox's
 *      TEST_DATABASE_URL escape hatch used to reuse one physical database across every spec file
 *      in a single `pnpm test:integration` run, so it did.
 *   2. Making that replay idempotent (DROP SCHEMA + recreate before each call) ran headlong into a
 *      second, genuinely surprising fact observed directly against this exact setup, not
 *      theorized: two spec files' own calls to this function can have their async work interleave
 *      closely enough to race each other - `--runInBand` only guarantees Jest doesn't run test
 *      *bodies* in parallel, not that one file's `beforeAll` can never overlap with the next
 *      file's. A shared advisory lock around a shared schema reset still left a window where one
 *      file's later reset could wipe the schema out from under another file's still-running tests.
 * Giving every call its own uniquely-named database - real isolation, not a shared, reset-between
 * mutable one - removes the shared state those two failure modes both depend on, matching what
 * Testcontainers already guarantees on the other path.
 */
async function createIsolatedDatabase(adminUrl: string): Promise<{ url: string; name: string; drop: () => Promise<void> }> {
  const name = `fodip_test_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;

  return {
    url: url.toString(),
    name,
    async drop() {
      const dropAdmin = new Client({ connectionString: adminUrl });
      await dropAdmin.connect();
      try {
        // Terminate anything still attached (the pool this database backed should already be
        // closed by the time stop() calls this, but a defensive DROP survives a straggler too).
        await dropAdmin.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [name],
        );
        await dropAdmin.query(`DROP DATABASE IF EXISTS "${name}"`);
      } finally {
        await dropAdmin.end();
      }
    },
  };
}

export async function startIntegrationDatabase(): Promise<IntegrationDatabase> {
  // Escape hatch for environments where Testcontainers itself can't reach an image registry
  // (a locked-down sandbox's egress policy, an offline machine with Postgres already installed
  // natively) but a real, empty, disposable Postgres is available some other way: point
  // TEST_DATABASE_URL at it and the same migrations + reset()/stop() contract applies, container
  // or not. CI and every contributor with a working Docker daemon should leave this unset - that's
  // the default, more hermetic path (a genuinely disposable container, no pre-existing state to
  // worry about).
  const externalUrl = process.env.TEST_DATABASE_URL;
  const container = externalUrl
    ? undefined
    : await new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase('fodip_test').withUsername('fodip_test').withPassword('fodip_test').start();
  // On the TEST_DATABASE_URL path, never migrate directly against the database the env var names
  // - see createIsolatedDatabase's own comment for why a dedicated, uniquely-named database per
  // call (not a shared one, reset between calls) is what actually makes this path behave like
  // Testcontainers' real per-file isolation instead of only resembling it.
  const isolated = externalUrl ? await createIsolatedDatabase(externalUrl) : undefined;
  const connectionUri = isolated?.url ?? container!.getConnectionUri();

  const pool = new Pool({ connectionString: connectionUri, max: 5 });
  for (const file of migrationFiles()) {
    await pool.query(readFileSync(file, 'utf8'));
  }

  // Real DatabaseService, not a stand-in: constructed the same way Nest's DI would (ConfigService
  // reading DATABASE_URL/DATABASE_SSL), so integration specs run the exact connection-pooling and
  // transaction code production traffic goes through.
  const config = new ConfigService({ DATABASE_URL: connectionUri, DATABASE_SSL: 'false' });
  const db = new DatabaseService(config);

  return {
    db,
    pool,
    async reset() {
      const { rows } = await pool.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
      );
      const tables = rows
        .filter((row) => !SEED_ONLY_TABLES.has(row.tablename))
        .map((row) => `"${row.tablename}"`);
      if (tables.length === 0) return;
      // CASCADE handles FK ordering for us; sequences used via nextval() (financement_numero_seq,
      // dossier_numero_seq) are intentionally left untouched - they only need to keep producing
      // unique values across tests, not reset to 1.
      await pool.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
    },
    async stop() {
      await db.onModuleDestroy();
      await pool.end();
      await container?.stop();
      await isolated?.drop();
    },
  };
}
