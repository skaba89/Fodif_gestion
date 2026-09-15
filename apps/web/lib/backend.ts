import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const LEGACY_ACCESS_COOKIE = 'fodip_access_token';
const SECURE_ACCESS_COOKIE = '__Host-fodip_access_token';

function usesSecureCookies(): boolean {
  return process.env.COOKIE_SECURE === 'true';
}

function accessCookieName(): string {
  return usesSecureCookies() ? SECURE_ACCESS_COOKIE : LEGACY_ACCESS_COOKIE;
}

function sessionCookieMaxAge(): number {
  const configured = Number.parseInt(process.env.SESSION_COOKIE_MAX_AGE_SECONDS ?? '', 10);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : 15 * 60;
}

export async function sessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(accessCookieName())?.value ?? store.get(LEGACY_ACCESS_COOKIE)?.value;
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(accessCookieName(), token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: usesSecureCookies(),
    path: '/',
    maxAge: sessionCookieMaxAge(),
  });
}

export function clearSessionCookies(response: NextResponse): void {
  for (const name of new Set([accessCookieName(), LEGACY_ACCESS_COOKIE])) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'strict',
      secure: name.startsWith('__Host-'),
      path: '/',
      maxAge: 0,
    });
  }
}

/** Keep the bearer token inside the BFF: only MFA/user fields may cross into the browser. */
export async function sessionResponseFromBackend(backend: Response): Promise<NextResponse> {
  const text = await backend.text();
  const contentType = backend.headers.get('content-type') ?? 'application/json';
  let body = text;
  let accessToken: string | undefined;

  if (text && contentType.includes('application/json')) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const payload = parsed as Record<string, unknown>;
        if (backend.ok && typeof payload.accessToken === 'string') accessToken = payload.accessToken;
        delete payload.accessToken;
        body = JSON.stringify(payload);
      }
    } catch {
      // Preserve a malformed upstream error instead of masking it with an unrelated BFF error.
    }
  }

  const response = new NextResponse(body || null, {
    status: backend.status,
    headers: { 'content-type': contentType, 'cache-control': 'no-store' },
  });
  if (accessToken) setSessionCookie(response, accessToken);
  return response;
}

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
  const token = await sessionToken();
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
