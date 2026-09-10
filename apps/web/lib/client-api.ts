import {
  isPortalId,
  LOGIN_HREF,
  resolvePortalFromPath,
  resolveRoleHome,
  rolesCanAccessPortal,
  type PortalId,
} from './portal-access';

const LAST_PORTAL_STORAGE_KEY = 'fodip:last-portal';

interface SessionContext {
  roles?: string[];
}

function resolveBrowserPortal(): PortalId | undefined {
  if (typeof window === 'undefined') return undefined;

  const directPortal = resolvePortalFromPath(window.location.pathname);
  if (directPortal) return directPortal;

  try {
    const storedPortal = window.sessionStorage.getItem(LAST_PORTAL_STORAGE_KEY);
    if (isPortalId(storedPortal)) return storedPortal;
  } catch {
    // Storage may be disabled by browser privacy settings. The current pathname remains enough for
    // all portal-local pages, so this fallback is intentionally optional.
  }

  if (typeof document !== 'undefined' && document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin) {
        return resolvePortalFromPath(referrer.pathname);
      }
    } catch {
      // Ignore malformed/opaque referrers and preserve the original API error.
    }
  }

  return undefined;
}

function redirectExpiredSession() {
  if (typeof window === 'undefined') return;
  window.location.replace(`${LOGIN_HREF}?reason=session-expired`);
}

async function redirectWrongPortal() {
  if (typeof window === 'undefined') return;

  // Use native fetch here, not clientApi, otherwise a 401/403 from the session endpoint could
  // recursively invoke this handler.
  const sessionResponse = await fetch('/api/session/me', { cache: 'no-store' }).catch(() => null);
  if (!sessionResponse) return;
  if (sessionResponse.status === 401) {
    redirectExpiredSession();
    return;
  }
  if (!sessionResponse.ok) return;

  const session = (await sessionResponse.json().catch(() => ({}))) as SessionContext;
  const roles = session.roles ?? [];
  const currentPortal = resolveBrowserPortal();

  // A 403 inside a portal the role is legitimately allowed to use is a real permission failure,
  // not a navigation mistake. Preserve it for the page to explain instead of causing a loop.
  if (currentPortal && rolesCanAccessPortal(roles, currentPortal)) return;

  const roleHome = resolveRoleHome(roles);
  if (roleHome && window.location.pathname !== roleHome) {
    window.location.replace(roleHome);
  }
}

// Axe E5 (verrouillage optimiste, docs/14-ROADMAP-SAAS-PREMIUM.md) - carries the HTTP status
// alongside the message so a caller can react to a specific one (409 version conflict) without
// parsing message text. Purely additive: every existing catch that only reads `.message` is
// unaffected.
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function clientApi<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    if (response.status === 401) redirectExpiredSession();
    if (response.status === 403) await redirectWrongPortal();
    throw new ApiError(data?.message ?? 'Une erreur est survenue', response.status);
  }
  return data as T;
}
