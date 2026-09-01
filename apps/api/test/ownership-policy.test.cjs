const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ownsResource,
  canEditApplication,
  canSubmitApplication,
  nextApplicationStatus,
} = require('../src/ownership-policy.js');

test('PME can access only an explicitly linked enterprise', () => {
  assert.equal(ownsResource(['ent-a'], 'ent-a'), true);
  assert.equal(ownsResource(['ent-a'], 'ent-b'), false);
  assert.equal(ownsResource([], 'ent-a'), false);
});

test('only draft applications remain editable by PME', () => {
  assert.equal(canEditApplication('BROUILLON'), true);
  assert.equal(canEditApplication('SOUMIS'), false);
  assert.equal(canEditApplication('EN_INSTRUCTION'), false);
});

test('submission transition is one-way from draft to submitted', () => {
  assert.equal(canSubmitApplication('BROUILLON'), true);
  assert.equal(nextApplicationStatus('BROUILLON', 'SUBMIT'), 'SOUMIS');
  assert.equal(nextApplicationStatus('SOUMIS', 'SUBMIT'), 'SOUMIS');
});
