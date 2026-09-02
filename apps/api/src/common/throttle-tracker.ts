/**
 * Custom @nestjs/throttler trackers for the unauthenticated auth endpoints.
 *
 * The web app is a BFF: every browser login request is proxied server-side through the Next.js
 * app before it ever reaches this API, so `req.ip` here is the web container's own address, the
 * same for every user of the platform. Keying the throttle on IP alone would either rate-limit
 * the entire platform together (self-inflicted denial of service) or do nothing useful at all,
 * depending on deployment topology - it is not a meaningful signal in front of this BFF. Keying
 * on data from the request body instead (the email being attempted, or the specific one-time MFA
 * challenge being solved) gives each login attempt or MFA challenge its own bucket regardless of
 * where the request physically originated, and is arguably the more relevant control anyway: it
 * limits guesses against one account/challenge rather than traffic from one network address.
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
