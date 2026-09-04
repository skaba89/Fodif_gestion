const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluatePassword,
  hasAllPermissions,
  hasAnyRole,
  resolveJwtSecret,
  resolveJwtSigningKeys,
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

// Axe E4 (docs/14-ROADMAP-SAAS-PREMIUM.md) - JWT signing key rotation.
test('resolveJwtSigningKeys resolves a deterministic kid for the current secret alone when no previous secret is set', () => {
  const a = resolveJwtSigningKeys('x'.repeat(48), undefined, 'production');
  const b = resolveJwtSigningKeys('x'.repeat(48), undefined, 'production');
  assert.equal(a.currentKid, b.currentKid); // deterministic, not random per call
  assert.equal(Object.keys(a.keys).length, 1);
  assert.equal(a.keys[a.currentKid], 'x'.repeat(48));
});

test('resolveJwtSigningKeys gives a different secret a different kid', () => {
  const a = resolveJwtSigningKeys('x'.repeat(48), undefined, 'production');
  const b = resolveJwtSigningKeys('y'.repeat(48), undefined, 'production');
  assert.notEqual(a.currentKid, b.currentKid);
});

test('resolveJwtSigningKeys keeps the previous secret verifiable under its own kid, alongside the current one', () => {
  const current = 'x'.repeat(48);
  const previous = 'y'.repeat(48);
  const { currentKid, keys } = resolveJwtSigningKeys(current, previous, 'production');
  const previousKid = Object.keys(keys).find((kid) => kid !== currentKid);
  assert.equal(Object.keys(keys).length, 2);
  assert.equal(keys[currentKid], current);
  assert.equal(keys[previousKid], previous);
});

test('resolveJwtSigningKeys never lets JWT_SECRET_PREVIOUS overwrite the current key on a matching kid', () => {
  const secret = 'x'.repeat(48);
  const { currentKid, keys } = resolveJwtSigningKeys(secret, secret, 'production');
  assert.equal(Object.keys(keys).length, 1);
  assert.equal(keys[currentKid], secret);
});

test('resolveJwtSigningKeys ignores an empty/whitespace previous secret', () => {
  const { keys } = resolveJwtSigningKeys('x'.repeat(48), '   ', 'production');
  assert.equal(Object.keys(keys).length, 1);
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
