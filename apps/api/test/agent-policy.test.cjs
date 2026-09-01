const test = require('node:test');
const assert = require('node:assert/strict');
const { canClaimApplication, canReviewApplication, isReviewStatus } = require('../src/agent-policy.js');

test('only active review statuses can be claimed', () => {
  assert.equal(canClaimApplication({ statut: 'SOUMIS' }), true);
  assert.equal(canClaimApplication({ statut: 'EN_INSTRUCTION' }), true);
  assert.equal(canClaimApplication({ statut: 'PRET_COMITE' }), false);
});

test('only the assigned agent can move an application', () => {
  const application = { statut: 'EN_INSTRUCTION', agentResponsableId: 'agent-a' };
  assert.equal(canReviewApplication({ sub: 'agent-a' }, application, 'PRET_COMITE'), true);
  assert.equal(canReviewApplication({ sub: 'agent-b' }, application, 'PRET_COMITE'), false);
});

test('review workflow rejects invalid transitions', () => {
  assert.equal(canReviewApplication(
    { sub: 'agent-a' },
    { statut: 'SOUMIS', agentResponsableId: 'agent-a' },
    'PRET_COMITE',
  ), false);
  assert.equal(isReviewStatus('COMPLEMENT_REQUIS'), true);
  assert.equal(isReviewStatus('APPROUVE'), false);
});
