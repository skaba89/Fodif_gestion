'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAmortizationSchedule, validateAvailableAmount, validateImpact } = require('../src/finance-policy');

test('builds a complete schedule with exact principal reconciliation', () => {
  const schedule = buildAmortizationSchedule(1000000, 12, 3, '2026-01-31');
  assert.equal(schedule.length, 3);
  assert.equal(schedule[0].dueDate, '2026-02-28');
  assert.equal(schedule[1].dueDate, '2026-03-31');
  assert.equal(schedule.reduce((sum, item) => sum + item.capitalDue, 0), 1000000);
  assert.ok(schedule[0].interestDue > schedule[2].interestDue);
});

test('rejects commitments above the financing ceiling', () => {
  assert.equal(validateAvailableAmount(400, 700, 1000, 'Disbursement'), 'Disbursement amount exceeds the available balance');
  assert.equal(validateAvailableAmount(300, 700, 1000, 'Disbursement'), null);
});

test('validates coherent impact employment totals', () => {
  assert.equal(validateImpact({ nombreEmployes: 10, emploisFemmes: 6, emploisHommes: 5 }), 'Gender employment totals cannot exceed total employees');
  assert.equal(validateImpact({ nombreEmployes: 10, emploisFemmes: 6, emploisHommes: 4, chiffreAffaires: 1200 }), null);
});
