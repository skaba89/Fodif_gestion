import { NextResponse } from 'next/server';
import { backendApiUrl, clearSessionCookies, sessionToken } from '../../../../lib/backend';

// Axe E4 (session revocation, docs/14-ROADMAP-SAAS-PREMIUM.md) - clearing the cookie alone left
// the JWT itself valid on the API until its own natural expiry (up to JWT_ACCESS_TTL, 15 minutes
// by default): a stolen token, or a session left open on a shared workstation, stayed usable after
// an explicit "Déconnexion" click. Best-effort: the cookie is cleared either way (that's the part
// this browser actually controls), even if the backend call fails - a failed revocation call is a
// worse outcome for THIS token's remaining lifetime, not a worse outcome than not trying at all.
export async function POST() {
  const token = await sessionToken();
  if (token) {
    await fetch(backendApiUrl('/auth/logout'), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => undefined);
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
