const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluatePassword,
  hasAllPermissions,
  hasAnyRole,
  resolveJwtSecret,
  parseDurationSeconds,
} = require('../src/security-policy.js');

test('password policy accepts a strong password', () => {
  assert.deepEqual(evaluatePassword('Fodip#2030Secure'), { valid: true, failures: [] });
});

test('password policy reports all missing requirements', () => {
  const result = evaluatePassword('weak');
  assert.equal(result.valid, false);
  assert.deepEqual(result.failures, ['minLength', 'uppercase', 'number', 'special']);
});

test('RBAC requires every requested permission', () => {
  assert.equal(hasAllPermissions(['company.read', 'company.update'], ['company.read']), true);
  assert.equal(hasAllPermissions(['company.read'], ['company.read', 'company.update']), false);
});

test('role policy accepts at least one authorized role', () => {
  assert.equal(hasAnyRole(['PME'], ['PME', 'SUPER_ADMIN']), true);
  assert.equal(hasAnyRole(['PME'], ['AGENT_FODIP', 'SUPER_ADMIN']), false);
  assert.equal(hasAnyRole(['PME'], []), true);
});

test('JWT secret policy blocks weak production secrets', () => {
  assert.throws(() => resolveJwtSecret('CHANGE_ME', 'production'), /JWT_SECRET/);
  assert.equal(resolveJwtSecret('', 'development').startsWith('fodip-dev-only'), true);
  assert.equal(resolveJwtSecret('x'.repeat(48), 'production'), 'x'.repeat(48));
});

test('duration parser converts supported JWT TTL values to seconds', () => {
  assert.equal(parseDurationSeconds('15m'), 900);
  assert.equal(parseDurationSeconds('2h'), 7200);
  assert.equal(parseDurationSeconds('7d'), 604800);
  assert.equal(parseDurationSeconds('invalid', 300), 300);
});
