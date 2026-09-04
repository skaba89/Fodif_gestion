import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const ACCESS_COOKIE = 'fodip_access_token';

export function backendApiUrl(path: string): string {
  const configured = (process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const base = configured.endsWith('/api/v1') ? configured : `${configured}/api/v1`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Same as backendApiUrl, but for a URL the *browser* will navigate to directly (OIDC sign-in),
 * not one this server fetches on the browser's behalf. Usually identical to API_BASE_URL - it
 * only differs under Docker Compose, where API_BASE_URL is the api container's internal
 * hostname (`http://api:4000`, unreachable from the browser) and API_PUBLIC_URL is the port
 * published to the host instead. Falls back to API_BASE_URL when unset, which is already correct
 * for hosted deployments (Render, ...) where the API has one public URL either way.
 */
export function publicBackendUrl(path: string): string {
  const configured = (process.env.API_PUBLIC_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const base = configured.endsWith('/api/v1') ? configured : `${configured}/api/v1`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Sprint Enterprise 0, axe E5 (intégrité financière, docs/14-ROADMAP-SAAS-PREMIUM.md) - forwards
 * the browser's `Idempotency-Key` header to the backend API, which enforces the actual dedup
 * (apps/api/src/common/idempotency.service.ts). Without this, a route handler that doesn't
 * explicitly pass it through `proxyWithSession`'s `init.headers` would silently drop it - the
 * header would exist on the incoming Next.js request but never reach the API, leaving the
 * protection wired server-side but inert for every browser call. Only forwards the one header
 * this axis defined; not a general passthrough of arbitrary incoming headers.
 */
export function idempotencyKeyHeaders(request: Request): HeadersInit | undefined {
  const key = request.headers.get('idempotency-key');
  return key ? { 'idempotency-key': key } : undefined;
}

export async function proxyWithSession(path: string, init: RequestInit = {}): Promise<NextResponse> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Authentication required' }, { status: 401 });

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (typeof init.body === 'string' && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const response = await fetch(backendApiUrl(path), { ...init, headers, cache: 'no-store' });
  const body = await response.arrayBuffer();
  const responseHeaders: Record<string, string> = {
    'content-type': response.headers.get('content-type') ?? 'application/json',
  };
  const disposition = response.headers.get('content-disposition');
  const cacheControl = response.headers.get('cache-control');
  if (disposition) responseHeaders['content-disposition'] = disposition;
  if (cacheControl) responseHeaders['cache-control'] = cacheControl;
  return new NextResponse(body.byteLength > 0 ? body : null, {
    status: response.status,
    headers: responseHeaders,
  });
}
