#!/usr/bin/env node
'use strict';

/**
 * Creates the first SUPER_ADMIN without loading public demo fixtures.
 *
 * The command is safe to run at every container start: a PostgreSQL advisory lock serializes
 * concurrent starts and an existing active SUPER_ADMIN makes it a no-op. Remove the BOOTSTRAP_*
 * variables from Render immediately after the first successful deployment.
 */

const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { shouldUseSsl } = require('./run-migrations');

// Full checkout: scripts/ and src/ are siblings. Runtime image: scripts/ and compiled dist/ are
// siblings because source files are deliberately excluded. Resolve the layout explicitly so the
// exact same command works in tests and in Render's minimal image.
const securityPolicyPath = fs.existsSync(path.resolve(__dirname, '..', 'src', 'security-policy.js'))
  ? path.resolve(__dirname, '..', 'src', 'security-policy.js')
  : path.resolve(__dirname, '..', 'dist', 'security-policy.js');
const { evaluatePassword } = require(securityPolicyPath);

const ADVISORY_LOCK_KEY = '4108716353481239790';

function resolveBootstrapConfig(env = process.env) {
  const values = {
    email: env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(),
    nom: env.BOOTSTRAP_ADMIN_NOM?.trim(),
    prenom: env.BOOTSTRAP_ADMIN_PRENOM?.trim() || null,
    password: env.BOOTSTRAP_ADMIN_PASSWORD,
  };
  const configured = [values.email, values.nom, values.password].filter(Boolean).length;
  if (configured === 0) return null;
  if (configured !== 3) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NOM and BOOTSTRAP_ADMIN_PASSWORD must be set together.');
  }
  if (!/^\S+@\S+\.\S+$/.test(values.email)) throw new Error('BOOTSTRAP_ADMIN_EMAIL is invalid.');
  const passwordCheck = evaluatePassword(values.password);
  if (!passwordCheck.valid) {
    throw new Error(`BOOTSTRAP_ADMIN_PASSWORD does not meet policy: ${passwordCheck.failures.join(', ')}.`);
  }
  return values;
}

async function bootstrapSuperAdmin(client, config, log = console.log) {
  const { rows: lockRows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [ADVISORY_LOCK_KEY]);
  if (!lockRows[0]?.locked) throw new Error('Another SUPER_ADMIN bootstrap is already running.');

  try {
    const existing = await client.query(
      `SELECT utilisateur.id
       FROM utilisateurs utilisateur
       JOIN utilisateur_roles utilisateur_role ON utilisateur_role.utilisateur_id = utilisateur.id
       JOIN roles role ON role.id = utilisateur_role.role_id
       WHERE utilisateur.actif = TRUE AND role.code = 'SUPER_ADMIN'
       LIMIT 1`,
    );
    if (existing.rowCount > 0) {
      log('An active SUPER_ADMIN already exists; bootstrap skipped.');
      return { created: false };
    }

    const passwordHash = await bcrypt.hash(config.password, 12);
    await client.query('BEGIN');
    try {
      const role = await client.query("SELECT id FROM roles WHERE code = 'SUPER_ADMIN'");
      if (!role.rows[0]) throw new Error('SUPER_ADMIN role is missing; run migrations first.');
      const inserted = await client.query(
        `INSERT INTO utilisateurs (email, nom, prenom, password_hash, actif, mfa_required)
         VALUES ($1, $2, $3, $4, TRUE, TRUE)
         RETURNING id`,
        [config.email, config.nom, config.prenom, passwordHash],
      );
      const id = inserted.rows[0].id;
      await client.query(
        'INSERT INTO utilisateur_roles (utilisateur_id, role_id) VALUES ($1, $2)',
        [id, role.rows[0].id],
      );
      await client.query(
        `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'BOOTSTRAP_SUPER_ADMIN', 'UTILISATEUR', $1, $2)`,
        [id, JSON.stringify({ roles: ['SUPER_ADMIN'], mfaRequired: true })],
      );
      await client.query('COMMIT');
      log('Initial SUPER_ADMIN created with mandatory MFA enrollment.');
      return { created: true, id };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined);
  }
}

async function main() {
  const config = resolveBootstrapConfig();
  if (!config) {
    console.log('SUPER_ADMIN bootstrap is not configured; skipped.');
    return;
  }
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
  const client = new Client({
    connectionString,
    ssl: shouldUseSsl(connectionString, process.env.DATABASE_SSL) ? { rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  try {
    await bootstrapSuperAdmin(client, config);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { ADVISORY_LOCK_KEY, bootstrapSuperAdmin, resolveBootstrapConfig };
