#!/usr/bin/env node
'use strict';

/**
 * Applies database/*.sql migrations (and optionally database/seeds/*.sql) against
 * DATABASE_URL_UNPOOLED when provided, otherwise DATABASE_URL,
 * in numeric filename order - the same files and order docker-compose's `migrations` service
 * applies, just without requiring a psql binary in the runtime image (this uses the `pg` package
 * already a dependency of @fodip/api).
 *
 * Sprint Enterprise 0 - "niveau 80-85/100" mission, axe fondations P0 4.4: replaces a plain
 * replay-every-file-every-time strategy with real migration tracking. A `schema_migrations` table
 * (version, filename, checksum, applied_at, execution_time_ms, success) records what has already
 * run, so:
 *   - only unapplied migrations execute on a re-run (previously every file re-ran every time,
 *     relying entirely on each file's own IF NOT EXISTS / ON CONFLICT guards to be a no-op -
 *     correct so far, but fragile: a future migration author forgetting that guard would silently
 *     corrupt data on a second run, with nothing to catch it);
 *   - a migration that was already applied and has since been edited on disk is detected via a
 *     SHA-256 checksum mismatch and refused, loudly, rather than silently skipped or re-applied;
 *   - a PostgreSQL advisory lock (pg_try_advisory_lock, non-blocking) prevents two concurrent runs
 *     from racing on the same database - the second run fails fast with a clear error instead of
 *     interleaving DDL with the first;
 *   - each migration file runs inside an explicit transaction and rolls back completely on error,
 *     stopping the whole run immediately rather than leaving a half-applied file's DDL in place.
 *
 * Seeds (`--seed`) are untouched by this tracking - they are dev/test-only fixtures, deliberately
 * never run in production (this script now refuses `--seed` outright when NODE_ENV=production),
 * and re-applying them isn't meant to be idempotent in the same sense schema migrations are.
 *
 * Meant to be run as a one-off job/shell command against a hosted database (Render Job, Netlify
 * one-off, or any machine with network access to it) after a fresh deploy, or as the
 * docker-compose `migrations` service's command - see docs/15-DEPLOIEMENT-TEST.md.
 *
 * Usage:
 *   DATABASE_URL_UNPOOLED=postgresql://... node apps/api/scripts/run-migrations.js
 *   DATABASE_URL=postgresql://... node apps/api/scripts/run-migrations.js --seed
 *   DATABASE_URL=postgresql://... DATABASE_SSL=false node apps/api/scripts/run-migrations.js
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Fixed, arbitrary 63-bit key for the advisory lock this script takes - any two processes calling
// pg_try_advisory_lock with the same key on the same database contend for the same lock,
// regardless of what table or schema they're about to touch. Derived once from
// sha256('fodip-digital-2030:schema-migrations') truncated to fit a signed bigint, not meaningful
// beyond being stable and (for all practical purposes) collision-free with any other lock this
// codebase or a dependency might take - never reuse this constant for an unrelated lock.
const ADVISORY_LOCK_KEY = '4108716353481239789';

// Matches DatabaseService's own DATABASE_SSL handling (apps/api/src/database/database.service.ts)
// so this script and the API agree on the same connection under the same environment: an explicit
// "true"/"false" wins outright, otherwise fall back to the hostname heuristic (docker-compose's
// `postgres` service and any other bare hostname get no SSL by default; a real hosted hostname
// does). Without this override, docker-compose's `migrations` service - connecting to hostname
// `postgres`, not `localhost` - would wrongly try SSL against a container that doesn't speak it.
function shouldUseSsl(connectionString, sslSetting) {
  if (sslSetting === 'true') return true;
  if (sslSetting === 'false') return false;
  return !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
}

/**
 * `database/` sits at a different depth relative to this file depending on which layout is
 * running: three levels up from `apps/api/scripts/` in a full repo checkout (local dev, CI's
 * `invariants`/`unit-tests` jobs, this file's own test suites), but only one level up from
 * `scripts/` in the Docker runtime image (apps/api/Dockerfile's `runtime` stage copies just
 * `scripts/` and `database/` as siblings under `/app`, not the whole `apps/api/...` tree). A fixed
 * `path.resolve(__dirname, '..', '..', '..')` silently resolves to `/` inside that image instead
 * of `/app` - `database/` then "doesn't exist" there, `listSqlFiles` returns an empty array (by
 * design, for a directory that's genuinely absent), and the migration run completes as a silent,
 * reported-successful no-op: found the hard way (Sprint Enterprise 0, mission "niveau 80-85/100",
 * Lot 1's own CI run - `docker compose up`'s `migrations` service exited 0 with zero log output,
 * so `seed` started against a schema that was never actually created and failed immediately on its
 * first INSERT). Try every layout this script is known to run under rather than assuming one.
 */
function resolveDatabaseDir() {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', 'database'), // apps/api/scripts/ -> repo root (checkout)
    path.resolve(__dirname, '..', 'database'), // scripts/ -> /app (Docker runtime image)
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Could not locate the database/ migrations directory (tried: ${candidates.join(', ')})`);
  }
  return found;
}

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{3}_.*\.sql$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

/** Applies each file as its own simple query, in order - no tracking, no transaction wrapping. Used for seeds, which are intentionally untracked. */
async function applyFiles(client, files, log = console.log) {
  for (const file of files) {
    log(`Applying ${file}`);
    const sql = fs.readFileSync(file, 'utf8');
    await client.query(sql);
  }
}

function versionOf(filePath) {
  const match = path.basename(filePath).match(/^(\d{3})_/);
  if (!match) throw new Error(`${filePath}: filename doesn't start with a 3-digit version prefix`);
  return match[1];
}

function checksumOf(sql) {
  return crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
}

async function ensureSchemaMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(3) PRIMARY KEY,
      filename TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_time_ms INTEGER NOT NULL,
      success BOOLEAN NOT NULL
    )
  `);
}

async function recordAttempt(client, { version, filename, checksum, executionTimeMs, success }) {
  await client.query(
    `INSERT INTO schema_migrations (version, filename, checksum, applied_at, execution_time_ms, success)
     VALUES ($1, $2, $3, NOW(), $4, $5)
     ON CONFLICT (version) DO UPDATE SET
       filename = EXCLUDED.filename, checksum = EXCLUDED.checksum, applied_at = NOW(),
       execution_time_ms = EXCLUDED.execution_time_ms, success = EXCLUDED.success`,
    [version, filename, checksum, executionTimeMs, success],
  );
}

/**
 * The versioned, checksummed, locked migration runner - what `database/*.sql` goes through.
 * Assumes `client` is already connected. Throws (and stops immediately) on the first failure,
 * whether that's a checksum mismatch on an already-applied file, a lock already held by a
 * concurrent run, or the migration SQL itself failing.
 */
async function applyMigrations(client, files, log = console.log) {
  const { rows: lockRows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [ADVISORY_LOCK_KEY]);
  if (!lockRows[0].locked) {
    throw new Error('Another migration run already holds the advisory lock on this database - refusing to run concurrently.');
  }

  try {
    await ensureSchemaMigrationsTable(client);
    const { rows: appliedRows } = await client.query(
      'SELECT version, checksum FROM schema_migrations WHERE success = TRUE',
    );
    const checksumByVersion = new Map(appliedRows.map((row) => [row.version, row.checksum]));

    for (const file of files) {
      const version = versionOf(file);
      const filename = path.basename(file);
      const sql = fs.readFileSync(file, 'utf8');
      const checksum = checksumOf(sql);
      const previousChecksum = checksumByVersion.get(version);

      if (previousChecksum !== undefined) {
        if (previousChecksum !== checksum) {
          throw new Error(
            `${filename} (version ${version}) was already applied but its content has changed since ` +
            `(recorded checksum ${previousChecksum}, file now hashes to ${checksum}). ` +
            'Never edit an already-applied migration - add a new one instead.',
          );
        }
        log(`Skipping ${filename} (already applied, checksum unchanged)`);
        continue;
      }

      log(`Applying ${filename}`);
      const startedAt = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        await recordAttempt(client, { version, filename, checksum, executionTimeMs: Date.now() - startedAt, success: false })
          .catch(() => undefined); // best-effort failure record; never mask the original error with a bookkeeping failure
        throw error;
      }
      await recordAttempt(client, { version, filename, checksum, executionTimeMs: Date.now() - startedAt, success: true });
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined);
  }
}

async function main() {
  // Neon and other PgBouncer-backed providers expose a direct connection specifically for
  // migrations. Keep DATABASE_URL pooled for normal API traffic, and prefer the direct URL here
  // because advisory locks and migration/session semantics must stay on one backend connection.
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
    process.exitCode = 1;
    return;
  }

  const applySeed = process.argv.includes('--seed');
  if (applySeed && process.env.NODE_ENV === 'production') {
    console.error('--seed was passed with NODE_ENV=production - refusing. Seeds are dev/test fixtures, never a production data source.');
    process.exitCode = 1;
    return;
  }

  const databaseDir = resolveDatabaseDir();
  const files = listSqlFiles(databaseDir);
  // A resolved, existing database/ directory with zero numbered *.sql files in it is always a
  // bug (missing COPY in a Docker stage, a bad path, an emptied-out checkout) - not a valid "no
  // migrations to run yet" state for this codebase, which has had schema migrations since day
  // one. Fail loudly instead of silently reporting success on an empty run - see
  // resolveDatabaseDir's comment for exactly the incident this guards against.
  if (files.length === 0) {
    throw new Error(`${databaseDir} exists but contains no numbered migration files - refusing to report a no-op run as successful.`);
  }

  // Lazily required so this module can be unit-tested (listSqlFiles/shouldUseSsl/checksumOf/...)
  // without pg needing to be resolvable from the test runner's module graph.
  const { Client } = require('pg');
  const client = new Client({
    connectionString,
    ssl: shouldUseSsl(connectionString, process.env.DATABASE_SSL) ? { rejectUnauthorized: true } : undefined,
  });
  await client.connect();

  try {
    await applyMigrations(client, files);
    if (applySeed) {
      await applyFiles(client, listSqlFiles(path.join(databaseDir, 'seeds')));
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { shouldUseSsl, listSqlFiles, applyFiles, applyMigrations, checksumOf, versionOf, resolveDatabaseDir, ADVISORY_LOCK_KEY };
