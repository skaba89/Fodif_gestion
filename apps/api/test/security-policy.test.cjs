const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluatePassword,
  hasAllPermissions,
  hasAnyRole,
  resolveJwtSecret,
  parseDurationSeconds,
  deriveSecret,
  encryptWithKey,
  decryptWithKey,
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

test('deriveSecret is deterministic per context and differs across contexts', () => {
  const a1 = deriveSecret('base-secret-value', 'context-a');
  const a2 = deriveSecret('base-secret-value', 'context-a');
  const b = deriveSecret('base-secret-value', 'context-b');
  assert.equal(a1.equals(a2), true);
  assert.equal(a1.equals(b), false);
  assert.equal(a1.length, 32);
});

test('deriveSecret rejects missing inputs', () => {
  assert.throws(() => deriveSecret('', 'context'), /base secret/);
  assert.throws(() => deriveSecret('secret', ''), /derivation context/);
});

test('encryptWithKey/decryptWithKey round-trip a secret', () => {
  const key = deriveSecret('base-secret-value', 'mfa-test');
  const ciphertext = encryptWithKey('JBSWY3DPEHPK3PXP', key);
  assert.notEqual(ciphertext, 'JBSWY3DPEHPK3PXP');
  assert.equal(decryptWithKey(ciphertext, key), 'JBSWY3DPEHPK3PXP');
});

test('decryptWithKey rejects a tampered ciphertext', () => {
  const key = deriveSecret('base-secret-value', 'mfa-test');
  const ciphertext = encryptWithKey('JBSWY3DPEHPK3PXP', key);
  const tampered = Buffer.from(ciphertext, 'base64');
  tampered[tampered.length - 1] ^= 0xff;
  assert.throws(() => decryptWithKey(tampered.toString('base64'), key));
});

test('decryptWithKey rejects the wrong key', () => {
  const key = deriveSecret('base-secret-value', 'mfa-test');
  const otherKey = deriveSecret('different-secret-value', 'mfa-test');
  const ciphertext = encryptWithKey('JBSWY3DPEHPK3PXP', key);
  assert.throws(() => decryptWithKey(ciphertext, otherKey));
});
