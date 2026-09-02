'use strict';

const crypto = require('node:crypto');

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

/**
 * Derives a fixed-purpose 256-bit key from a base secret (e.g. JWT_SECRET) using HMAC-SHA256.
 * Lets several distinct keys (MFA secret encryption, MFA challenge signing, ...) be obtained
 * from a single already-validated secret instead of provisioning and rotating one env var per use.
 */
function deriveSecret(baseSecret, context) {
  if (typeof baseSecret !== 'string' || !baseSecret) throw new Error('A base secret is required to derive a key');
  if (typeof context !== 'string' || !context) throw new Error('A derivation context is required');
  return crypto.createHmac('sha256', baseSecret).update(context).digest();
}

/**
 * AES-256-GCM encrypt/decrypt helpers for small secrets at rest (e.g. TOTP seeds).
 * Output packs iv (12 bytes) + auth tag (16 bytes) + ciphertext into a single base64 string.
 */
function encryptWithKey(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

function decryptWithKey(payload, key) {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = {
  DEFAULT_PASSWORD_POLICY,
  evaluatePassword,
  hasAllPermissions,
  hasAnyRole,
  resolveJwtSecret,
  parseDurationSeconds,
  deriveSecret,
  encryptWithKey,
  decryptWithKey,
};
