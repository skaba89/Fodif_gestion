import { NextResponse } from 'next/server';
import { publicBackendUrl } from '../../../../../lib/backend';

const PORTALS = new Set(['agent', 'comite', 'direction', 'administration', 'auditeur']);

export async function GET(request: Request) {
  const portal = new URL(request.url).searchParams.get('portal');
  if (!portal || !PORTALS.has(portal)) {
    return NextResponse.json({ message: 'Unknown or missing portal' }, { status: 400 });
  }
  // Browser-facing redirect to the API's own OIDC start endpoint (which then redirects again, to
  // the identity provider) - must be the API's *public* URL, not the internal one this server
  // uses for its own fetches. See lib/backend.ts#publicBackendUrl.
  return NextResponse.redirect(publicBackendUrl(`/auth/oidc/login?portal=${encodeURIComponent(portal)}`));
}
