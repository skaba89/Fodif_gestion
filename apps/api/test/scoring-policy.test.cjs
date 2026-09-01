const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateScore, canScoreApplication, classifyScore } = require('../src/scoring-policy');

const criteria = [
  { id: 'c1', code: 'FINANCE', poids: 60, scoreMax: 100 },
  { id: 'c2', code: 'IMPACT', poids: 40, scoreMax: 20 },
];

test('calculates a normalized weighted score and classification', () => {
  const score = calculateScore(criteria, [
    { code: 'FINANCE', scoreObtenu: 80 },
    { code: 'IMPACT', scoreObtenu: 10 },
  ]);
  assert.equal(score.scoreTotal, 68);
  assert.deepEqual(classifyScore(score.scoreTotal), { niveauRisque: 'MODERE', recommandation: 'FAVORABLE_SOUS_CONDITIONS' });
});

test('requires every criterion exactly once and enforces score limits', () => {
  assert.throws(() => calculateScore(criteria, [{ code: 'FINANCE', scoreObtenu: 80 }]));
  assert.throws(() => calculateScore(criteria, [
    { code: 'FINANCE', scoreObtenu: 101 }, { code: 'IMPACT', scoreObtenu: 10 },
  ]));
});

test('only the assigned agent can score an application in instruction', () => {
  assert.equal(canScoreApplication({ sub: 'a1' }, { statut: 'EN_INSTRUCTION', agentResponsableId: 'a1' }), true);
  assert.equal(canScoreApplication({ sub: 'a2' }, { statut: 'EN_INSTRUCTION', agentResponsableId: 'a1' }), false);
  assert.equal(canScoreApplication({ sub: 'a1' }, { statut: 'PRET_COMITE', agentResponsableId: 'a1' }), false);
});
