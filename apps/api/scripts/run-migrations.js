#!/usr/bin/env node
'use strict';

/**
 * Applies database/*.sql migrations (and optionally database/seeds/*.sql) against DATABASE_URL,
 * in numeric filename order - the same files and order docker-compose's `migrations`/`seed`
 * services already apply via psql, just without requiring a psql binary in the runtime image
 * (this uses the `pg` package already a dependency of @fodip/api). Safe to re-run: every
 * migration file already guards its DDL with IF NOT EXISTS / ON CONFLICT.
 *
 * Meant to be run as a one-off job/shell command against a hosted database (Render Job, Netlify
 * one-off, or any machine with network access to it) after a fresh deploy - see
 * docs/15-DEPLOIEMENT-TEST.md.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node apps/api/scripts/run-migrations.js
 *   DATABASE_URL=postgresql://... node apps/api/scripts/run-migrations.js --seed
 */

const fs = require('node:fs');
const path = require('node:path');

function shouldUseSsl(connectionString) {
  return !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
}

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{3}_.*\.sql$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

async function applyFiles(client, files, log = console.log) {
  for (const file of files) {
    log(`Applying ${file}`);
    const sql = fs.readFileSync(file, 'utf8');
    await client.query(sql);
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required.');
    process.exitCode = 1;
    return;
  }

  const applySeed = process.argv.includes('--seed');
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const databaseDir = path.join(repoRoot, 'database');

  // Lazily required so this module can be unit-tested (listSqlFiles/shouldUseSsl) without pg
  // needing to be resolvable from the test runner's module graph.
  const { Client } = require('pg');
  const client = new Client({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: true } : undefined,
  });
  await client.connect();

  try {
    await applyFiles(client, listSqlFiles(databaseDir));
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

module.exports = { shouldUseSsl, listSqlFiles, applyFiles };
