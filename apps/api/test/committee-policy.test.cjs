const test = require('node:test');
const assert = require('node:assert/strict');
const { nextStatusForDecision, validateCommitteeDecision } = require('../src/committee-policy');

test('approval requires controlled financial terms', () => {
  assert.equal(validateCommitteeDecision({ decision: 'APPROUVE', montantApprouve: 90, dureeMois: 24 }, 100), null);
  assert.match(validateCommitteeDecision({ decision: 'APPROUVE', montantApprouve: 110, dureeMois: 24 }, 100), /cannot exceed/);
  assert.match(validateCommitteeDecision({ decision: 'APPROUVE', montantApprouve: 90, dureeMois: 0 }, 100), /Duration/);
});

test('rejection and complement require a motivated comment', () => {
  assert.match(validateCommitteeDecision({ decision: 'REJETE', commentaire: '' }, 100), /comment/);
  assert.equal(validateCommitteeDecision({ decision: 'COMPLEMENT_REQUIS', commentaire: 'Pièce manquante' }, 100), null);
});

test('committee decisions map to controlled workflow statuses', () => {
  assert.equal(nextStatusForDecision('APPROUVE'), 'APPROUVE');
  assert.throws(() => nextStatusForDecision('BROUILLON'));
});
