const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requireEnterpriseScope,
  canAccessEnterprise,
  canEditApplication,
  canSubmitApplication,
  normalizeCompanyPatch,
} = require('../src/pme-policy.js');

const userA = { entrepriseId: 'ent-a' };
const appA = { entrepriseId: 'ent-a', statut: 'BROUILLON' };

test('PME user must have an enterprise scope', () => {
  assert.equal(requireEnterpriseScope(userA), true);
  assert.equal(requireEnterpriseScope({}), false);
});

test('a PME cannot access another enterprise', () => {
  assert.equal(canAccessEnterprise(userA, 'ent-a'), true);
  assert.equal(canAccessEnterprise(userA, 'ent-b'), false);
});

test('a PME can edit only its own editable application', () => {
  assert.equal(canEditApplication(userA, appA), true);
  assert.equal(canEditApplication(userA, { ...appA, entrepriseId: 'ent-b' }), false);
  assert.equal(canEditApplication(userA, { ...appA, statut: 'ANALYSE' }), false);
});

test('submission is only allowed from BROUILLON', () => {
  assert.equal(canSubmitApplication(userA, appA), true);
  assert.equal(canSubmitApplication(userA, { ...appA, statut: 'SOUMIS' }), false);
});

test('company patch strips protected fields', () => {
  const patch = normalizeCompanyPatch({ raisonSociale: 'A', statut: 'SUSPENDU', codeFodip: 'HACK', nombreEmployes: 3 });
  assert.deepEqual(patch, { raisonSociale: 'A', nombreEmployes: 3 });
});
