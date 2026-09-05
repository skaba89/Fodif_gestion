'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootstrapSuperAdmin, resolveBootstrapConfig } = require('../scripts/bootstrap-super-admin');

const strongConfig = {
  email: 'admin@example.org', nom: 'Kaba', prenom: 'Cheickna', password: 'Institutionnel-2030!',
};

test('bootstrap is disabled when no bootstrap secret is configured', () => {
  assert.equal(resolveBootstrapConfig({}), null);
});

test('bootstrap rejects partial configuration', () => {
  assert.throws(
    () => resolveBootstrapConfig({ BOOTSTRAP_ADMIN_EMAIL: 'admin@example.org' }),
    /must be set together/,
  );
});

test('bootstrap normalizes a complete strong configuration', () => {
  assert.deepEqual(resolveBootstrapConfig({
    BOOTSTRAP_ADMIN_EMAIL: ' ADMIN@Example.org ',
    BOOTSTRAP_ADMIN_NOM: ' Kaba ',
    BOOTSTRAP_ADMIN_PRENOM: ' Cheickna ',
    BOOTSTRAP_ADMIN_PASSWORD: 'Institutionnel-2030!',
  }), {
    email: 'admin@example.org',
    nom: 'Kaba',
    prenom: 'Cheickna',
    password: 'Institutionnel-2030!',
  });
});

test('bootstrap enforces the institutional password policy', () => {
  assert.throws(() => resolveBootstrapConfig({
    BOOTSTRAP_ADMIN_EMAIL: 'admin@example.org',
    BOOTSTRAP_ADMIN_NOM: 'Kaba',
    BOOTSTRAP_ADMIN_PASSWORD: 'weak',
  }), /does not meet policy/);
});

test('bootstrap is an idempotent no-op when an active SUPER_ADMIN exists', async () => {
  const queries = [];
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.startsWith('SELECT pg_try_advisory_lock')) return { rows: [{ locked: true }], rowCount: 1 };
      if (sql.includes("role.code = 'SUPER_ADMIN'")) return { rows: [{ id: 'existing' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  };
  const result = await bootstrapSuperAdmin(client, strongConfig, () => undefined);
  assert.deepEqual(result, { created: false });
  assert.equal(queries.some(({ sql }) => sql.startsWith('INSERT INTO utilisateurs')), false);
});

test('bootstrap hashes the password, assigns SUPER_ADMIN and commits the audited account', async () => {
  const queries = [];
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.startsWith('SELECT pg_try_advisory_lock')) return { rows: [{ locked: true }], rowCount: 1 };
      if (sql.includes("role.code = 'SUPER_ADMIN'")) return { rows: [], rowCount: 0 };
      if (sql === "SELECT id FROM roles WHERE code = 'SUPER_ADMIN'") return { rows: [{ id: 'role-id' }], rowCount: 1 };
      if (sql.startsWith('INSERT INTO utilisateurs')) return { rows: [{ id: 'admin-id' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  };
  const result = await bootstrapSuperAdmin(client, strongConfig, () => undefined);
  assert.deepEqual(result, { created: true, id: 'admin-id' });
  const userInsert = queries.find(({ sql }) => sql.startsWith('INSERT INTO utilisateurs'));
  assert.notEqual(userInsert.values[3], strongConfig.password);
  assert.match(userInsert.values[3], /^\$2[aby]\$/);
  assert.equal(queries.some(({ sql }) => sql.startsWith('INSERT INTO utilisateur_roles')), true);
  assert.equal(queries.some(({ sql }) => sql.includes("'BOOTSTRAP_SUPER_ADMIN'")), true);
  assert.equal(queries.some(({ sql }) => sql === 'COMMIT'), true);
});
