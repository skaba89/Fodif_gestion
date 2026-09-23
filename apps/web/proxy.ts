import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { csrfRejectionReason, publicRequestOrigin } from './lib/request-security';

export function proxy(request: NextRequest) {
  const reason = csrfRejectionReason({
    method: request.method,
    requestOrigin: publicRequestOrigin(request),
    originHeader: request.headers.get('origin'),
    fetchSiteHeader: request.headers.get('sec-fetch-site'),
    appEnvironment: process.env.APP_ENV,
  });
  if (!reason) return NextResponse.next();
  return NextResponse.json(
    { message: 'Requête refusée par la protection CSRF.' },
    { status: 403, headers: {
      'cache-control': 'no-store', vary: 'Origin, Sec-Fetch-Site',
      'x-fodip-request-rejection': reason,
    } },
  );
}

export const config = { matcher: '/api/:path*' };
