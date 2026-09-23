import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const OIDC_DELIVERY_COOKIE = 'fodip_oidc_delivery';
const SECURE_OIDC_DELIVERY_COOKIE = '__Host-fodip_oidc_delivery';

function usesSecureCookies(): boolean { return process.env.COOKIE_SECURE === 'true'; }
function deliveryCookieName(): string {
  return usesSecureCookies() ? SECURE_OIDC_DELIVERY_COOKIE : OIDC_DELIVERY_COOKIE;
}

export function isValidOidcDeliveryToken(token: string | null): token is string {
  if (!token || token.length > 8_192) return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0 && /^[A-Za-z0-9_-]+$/.test(part));
}

export async function oidcDeliveryToken(): Promise<string | undefined> {
  return (await cookies()).get(deliveryCookieName())?.value;
}

export function setOidcDeliveryCookie(response: NextResponse, token: string): void {
  response.cookies.set(deliveryCookieName(), token, {
    httpOnly: true, sameSite: 'strict', secure: usesSecureCookies(), path: '/', maxAge: 2 * 60,
  });
}

export function clearOidcDeliveryCookie(response: NextResponse): void {
  response.cookies.set(deliveryCookieName(), '', {
    httpOnly: true, sameSite: 'strict', secure: usesSecureCookies(), path: '/', maxAge: 0,
  });
}
