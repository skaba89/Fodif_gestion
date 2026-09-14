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
 * Axe E4 (docs/14-ROADMAP-SAAS-PREMIUM.md) - JWT signing key rotation. Resolves the current
 * signing secret (via resolveJwtSecret, unchanged) plus an optional previous secret still
 * accepted for VERIFICATION only, each tagged with a short key id (`kid`, the first 8 hex
 * characters of its own SHA-256 hash - deterministic, so rotating is just "move JWT_SECRET's old
 * value into JWT_SECRET_PREVIOUS", no `kid` to hand-manage, and one-way, so a `kid` never leaks
 * anything about the secret it names). Access tokens are short-lived (15 minutes by default,
 * JWT_ACCESS_TTL) and this platform has no separate refresh-token flow, so a previous secret only
 * needs to stay accepted for that same short window after a rotation - long enough for tokens
 * already handed out to finish their natural life, never indefinitely.
 *
 * Deliberately scoped to JWT signing alone. PII, MFA and OIDC now resolve independent purpose
 * secrets and keyrings below; their rotation windows are configured separately so a JWT rotation
 * cannot make persisted data unreadable.
 */
function computeKeyId(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 8);
}

function resolveJwtSigningKeys(secret, previousSecret, environment) {
  const currentSecret = resolveJwtSecret(secret, environment);
  const currentKid = computeKeyId(currentSecret);
  const keys = { [currentKid]: currentSecret };

  const normalizedPrevious = typeof previousSecret === 'string' ? previousSecret.trim() : '';
  if (normalizedPrevious) {
    const previousKid = computeKeyId(normalizedPrevious);
    // Never let an unrelated-but-identical-hash edge case, or simply forgetting to clear
    // JWT_SECRET_PREVIOUS after rotating back to the same value, overwrite the current key.
    if (previousKid !== currentKid) keys[previousKid] = normalizedPrevious;
  }

  return { currentKid, keys };
}

/**
 * Derives a fixed-purpose 256-bit key from a base secret using HMAC-SHA256. The base secret is
 * dedicated per use in institutional environments; the context adds domain separation and keeps
 * the historical JWT-derived format readable during migration.
 */
function deriveSecret(baseSecret, context) {
  if (typeof baseSecret !== 'string' || !baseSecret) throw new Error('A base secret is required to derive a key');
  if (typeof context !== 'string' || !context) throw new Error('A derivation context is required');
  return crypto.createHmac('sha256', baseSecret).update(context).digest();
}

/**
 * Resolves one secret dedicated to a single cryptographic purpose. PPD/PROD deployments must
 * provision every required dedicated secret; development and qualification retain the historical
 * JWT_SECRET fallback so upgrades remain deployable before the operators complete secret rollout.
 * A supplied value is always validated in production-like environments instead of silently
 * falling back when it is weak.
 */
function resolvePurposeSecret(
  secret,
  fallbackSecret,
  nodeEnvironment,
  appEnvironment,
  variableName,
  requiredInInstitutionalEnvironment = true,
) {
  const normalized = typeof secret === 'string' ? secret.trim() : '';
  const nodeEnv = String(nodeEnvironment || 'development').toLowerCase();
  const appEnv = String(appEnvironment || 'DEV').toUpperCase();
  const productionLike = nodeEnv === 'production' || appEnv === 'PPD' || appEnv === 'PROD';
  const unsafe = !normalized || normalized === 'CHANGE_ME' || normalized.length < 32;

  if (normalized && unsafe && productionLike) {
    throw new Error(`${variableName} must contain at least 32 characters in production`);
  }
  if (!normalized && requiredInInstitutionalEnvironment && (appEnv === 'PPD' || appEnv === 'PROD')) {
    throw new Error(`${variableName} is required in ${appEnv}`);
  }

  return unsafe ? fallbackSecret : normalized;
}

/**
 * Builds a purpose-bound keyring. New values carry the current key id, while previous and legacy
 * roots stay available only for verification/decryption during a controlled rotation.
 */
function createPurposeKeyring(currentSecret, previousSecret, legacySecrets, context) {
  const keys = {};
  const add = (baseSecret) => {
    if (typeof baseSecret !== 'string' || !baseSecret.trim()) return;
    const key = deriveSecret(baseSecret.trim(), context);
    const kid = computeKeyId(key);
    if (!keys[kid]) keys[kid] = key;
  };

  add(currentSecret);
  add(previousSecret);
  for (const legacySecret of Array.isArray(legacySecrets) ? legacySecrets : []) add(legacySecret);

  const currentKey = deriveSecret(currentSecret, context);
  const currentKid = computeKeyId(currentKey);
  return { currentKid, currentKey, keys };
}

/**
 * Versioned AES-256-GCM envelope. Historical payloads had no prefix; decryption tries every
 * explicitly configured candidate for those values. A versioned value names one exact key and
 * therefore fails closed when that key is no longer in the deployment keyring.
 */
function encryptVersionedWithKeyring(plaintext, keyring) {
  return `v1:${keyring.currentKid}:${encryptWithKey(plaintext, keyring.currentKey)}`;
}

function decryptVersionedWithKeyring(payload, keyring) {
  const value = String(payload);
  const versioned = value.match(/^v1:([0-9a-f]{8}):(.+)$/);
  if (versioned) {
    const key = keyring.keys[versioned[1]];
    if (!key) throw new Error(`Unknown encryption key id: ${versioned[1]}`);
    return decryptWithKey(versioned[2], key);
  }
  if (value.startsWith('v1:')) throw new Error('Invalid versioned ciphertext envelope');

  let lastError;
  for (const key of Object.values(keyring.keys)) {
    try {
      return decryptWithKey(value, key);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No decryption key is configured');
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
  resolveJwtSigningKeys,
  parseDurationSeconds,
  deriveSecret,
  resolvePurposeSecret,
  createPurposeKeyring,
  encryptWithKey,
  decryptWithKey,
  encryptVersionedWithKeyring,
  decryptVersionedWithKeyring,
};
