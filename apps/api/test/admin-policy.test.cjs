'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canDeactivateUser, normalizeRoleCodes, requiresMfa, validateUserScope } = require('../src/admin-policy');

test('normalizes and deduplicates role codes', () => {
  assert.deepEqual(normalizeRoleCodes([' pme ', 'AGENT_FODIP', 'PME']), ['AGENT_FODIP', 'PME']);
});

test('requires an enterprise scope for a PME account', () => {
  assert.equal(validateUserScope(['PME'], null), 'PME_ENTERPRISE_SCOPE_REQUIRED');
  assert.equal(validateUserScope(['PME'], 'company-id'), null);
});

test('identifies privileged roles requiring MFA', () => {
  assert.equal(requiresMfa(['DIRECTION_FODIP']), true);
  assert.equal(requiresMfa(['PME']), false);
});

test('protects the current and last active super administrator', () => {
  assert.equal(canDeactivateUser('a', 'a', ['SUPER_ADMIN'], 2), false);
  assert.equal(canDeactivateUser('a', 'b', ['SUPER_ADMIN'], 1), false);
  assert.equal(canDeactivateUser('a', 'b', ['SUPER_ADMIN'], 2), true);
  assert.equal(canDeactivateUser('a', 'b', ['PME'], 1), true);
});
