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
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
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

export interface IntegrationDatabase {
  /** The production `DatabaseService`, wired to the disposable container - use this to exercise repositories/services. */
  db: DatabaseService;
  /** Raw `pg` pool for fixture setup and assertions the repository layer doesn't expose. */
  pool: Pool;
  /** Wipes every table's rows (structure kept) so the next test starts from an empty database. */
  reset(): Promise<void>;
  /** Stops the pool and the container. Call once in `afterAll`. */
  stop(): Promise<void>;
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
  const connectionUri = externalUrl ?? container!.getConnectionUri();

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
      if (rows.length === 0) return;
      const tables = rows.map((row) => `"${row.tablename}"`).join(', ');
      // CASCADE handles FK ordering for us; sequences used via nextval() (financement_numero_seq,
      // dossier_numero_seq) are intentionally left untouched - they only need to keep producing
      // unique values across tests, not reset to 1.
      await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
    },
    async stop() {
      await db.onModuleDestroy();
      await pool.end();
      await container?.stop();
    },
  };
}
