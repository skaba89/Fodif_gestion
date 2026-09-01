'use strict';

const DEFAULT_PASSWORD_POLICY = Object.freeze({
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
});

function evaluatePassword(password, policy = DEFAULT_PASSWORD_POLICY) {
  const value = typeof password === 'string' ? password : '';
  const failures = [];

  if (value.length < policy.minLength) failures.push('minLength');
  if (policy.requireUppercase && !/[A-Z]/.test(value)) failures.push('uppercase');
  if (policy.requireLowercase && !/[a-z]/.test(value)) failures.push('lowercase');
  if (policy.requireNumber && !/[0-9]/.test(value)) failures.push('number');
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(value)) failures.push('special');

  return { valid: failures.length === 0, failures };
}

function hasAllPermissions(granted, required) {
  const grantedSet = new Set(Array.isArray(granted) ? granted : []);
  return (Array.isArray(required) ? required : []).every((permission) => grantedSet.has(permission));
}

function hasAnyRole(granted, required) {
  const requiredRoles = Array.isArray(required) ? required : [];
  if (requiredRoles.length === 0) return true;
  const grantedSet = new Set(Array.isArray(granted) ? granted : []);
  return requiredRoles.some((role) => grantedSet.has(role));
}

function parseDurationSeconds(value, fallbackSeconds = 900) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value !== 'string' || !value.trim()) return fallbackSeconds;
  const match = value.trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  return amount * multiplier;
}

function resolveJwtSecret(secret, environment) {
  const normalized = typeof secret === 'string' ? secret.trim() : '';
  const env = String(environment || 'development').toLowerCase();
  const unsafe = !normalized || normalized === 'CHANGE_ME' || normalized.length < 32;

  if (env === 'production' && unsafe) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production');
  }

  return unsafe ? 'fodip-dev-only-jwt-secret-change-before-production' : normalized;
}

module.exports = {
  DEFAULT_PASSWORD_POLICY,
  evaluatePassword,
  hasAllPermissions,
  hasAnyRole,
  resolveJwtSecret,
  parseDurationSeconds,
};
