'use strict';

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('A valid ISO date is required');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('A valid ISO date is required');
  }
  return date;
}

function addMonths(date, months) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}

function buildAmortizationSchedule(amount, annualRate, durationMonths, startDate) {
  const principal = Number(amount);
  const rate = Number(annualRate ?? 0);
  const duration = Number(durationMonths);
  const start = parseIsoDate(startDate);
  if (!(principal > 0)) throw new Error('Financing amount must be positive');
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Interest rate must be between 0 and 100');
  if (!Number.isInteger(duration) || duration < 1 || duration > 120) throw new Error('Duration must be between 1 and 120 months');

  const regularCapital = roundMoney(principal / duration);
  let outstanding = principal;
  return Array.from({ length: duration }, (_, index) => {
    const capitalDue = index === duration - 1 ? roundMoney(outstanding) : Math.min(regularCapital, roundMoney(outstanding));
    const interestDue = roundMoney(outstanding * (rate / 100 / 12));
    outstanding = roundMoney(outstanding - capitalDue);
    return {
      installmentNumber: index + 1,
      dueDate: addMonths(start, index + 1),
      capitalDue,
      interestDue,
      totalDue: roundMoney(capitalDue + interestDue),
    };
  });
}

function validateAvailableAmount(amount, committed, ceiling, label) {
  const requested = Number(amount);
  const used = Number(committed ?? 0);
  const maximum = Number(ceiling);
  if (!(requested > 0)) return `${label} amount must be positive`;
  if (!Number.isFinite(used) || !Number.isFinite(maximum) || used + requested > maximum + 0.001) {
    return `${label} amount exceeds the available balance`;
  }
  return null;
}

function validateImpact(input) {
  const integerFields = ['nombreEmployes', 'emploisFemmes', 'emploisHommes', 'emploisJeunes', 'emploisCrees', 'emploisMaintenus'];
  const amountFields = ['chiffreAffaires', 'chiffreExport', 'productionLocale'];
  for (const field of integerFields) {
    if (input[field] != null && (!Number.isInteger(Number(input[field])) || Number(input[field]) < 0)) return `${field} must be a non-negative integer`;
  }
  for (const field of amountFields) {
    if (input[field] != null && (!Number.isFinite(Number(input[field])) || Number(input[field]) < 0)) return `${field} must be non-negative`;
  }
  const employees = Number(input.nombreEmployes ?? 0);
  const women = Number(input.emploisFemmes ?? 0);
  const men = Number(input.emploisHommes ?? 0);
  if (input.nombreEmployes != null && women + men > employees) return 'Gender employment totals cannot exceed total employees';
  return null;
}

module.exports = { buildAmortizationSchedule, roundMoney, validateAvailableAmount, validateImpact };
