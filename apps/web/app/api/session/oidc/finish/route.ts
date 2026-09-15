import { NextResponse } from 'next/server';
import { backendApiUrl, sessionResponseFromBackend } from '../../../../../lib/backend';
import { clearOidcDeliveryCookie, oidcDeliveryToken } from '../../../../../lib/oidc-delivery';

export async function POST() {
  const token = await oidcDeliveryToken();
  if (!token) {
    return NextResponse.json(
      { message: 'Invalid or expired institutional sign-in session' },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  let response: NextResponse;
  try {
    const backend = await fetch(backendApiUrl('/auth/oidc/exchange'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }), cache: 'no-store',
    });
    response = await sessionResponseFromBackend(backend);
  } catch {
    response = NextResponse.json(
      { message: 'Institutional sign-in service unavailable' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
  clearOidcDeliveryCookie(response);
  return response;
}
