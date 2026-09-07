import { createHash } from 'node:crypto';

/**
 * Custom @nestjs/throttler trackers.
 *
 * The web app is a BFF: every browser request is proxied server-side through the Next.js app
 * before it reaches this API, so `req.ip` here can be the web container's own address, shared by
 * many users. Route-specific throttles therefore use a signal that is meaningful for the action
 * being protected instead of accidentally rate-limiting the entire platform together.
 */

export function trackLoginByEmail(req: Record<string, unknown>): string {
  const body = req?.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return email || String((req as { ip?: unknown })?.ip ?? 'unknown');
}

export function trackMfaByChallenge(req: Record<string, unknown>): string {
  const body = req?.body as { mfaChallenge?: unknown } | undefined;
  const challenge = typeof body?.mfaChallenge === 'string' ? body.mfaChallenge : '';
  return challenge || String((req as { ip?: unknown })?.ip ?? 'unknown');
}

/**
 * Tracker for authenticated endpoints reached through the BFF.
 *
 * ThrottlerGuard executes before JwtAuthGuard in AppModule, so `req.user` is not available yet.
 * The Authorization header is already present, however. Hashing it creates a stable bucket for
 * one bearer-token session without persisting the bearer token itself in throttling storage.
 * When no bearer token is present, falling back to the request IP preserves a defensive budget
 * for malformed/unauthenticated traffic before JwtAuthGuard rejects it.
 */
export function trackAuthenticatedSession(req: Record<string, unknown>): string {
  const headers = (req?.headers ?? {}) as Record<string, unknown>;
  const authorization =
    typeof headers.authorization === 'string' ? headers.authorization.trim() : '';

  if (!authorization) {
    return `ip:${String((req as { ip?: unknown })?.ip ?? 'unknown')}`;
  }

  return `session:${createHash('sha256').update(authorization).digest('hex')}`;
}
