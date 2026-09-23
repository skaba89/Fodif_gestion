import { NextResponse } from 'next/server';
import { isValidOidcDeliveryToken, setOidcDeliveryCookie } from '../../../../../lib/oidc-delivery';

/** Move the one-use credential out of the URL before any React code is loaded. */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get('token');
  const loginUrl = new URL('/connexion', 'https://relative.invalid');
  const headers = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };

  if (!isValidOidcDeliveryToken(token)) {
    loginUrl.searchParams.set('oidc_error', 'login_failed');
    return new NextResponse(null, {
      status: 303,
      headers: { ...headers, location: `${loginUrl.pathname}${loginUrl.search}` },
    });
  }

  loginUrl.searchParams.set('oidc', 'continue');
  const response = new NextResponse(null, {
    status: 303,
    headers: { ...headers, location: `${loginUrl.pathname}${loginUrl.search}` },
  });
  setOidcDeliveryCookie(response, token);
  return response;
}
