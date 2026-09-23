const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const STRICT_ENVIRONMENTS = new Set(['PPD', 'PROD']);

interface RequestSecurityInput {
  method: string;
  requestOrigin: string;
  originHeader: string | null;
  fetchSiteHeader: string | null;
  appEnvironment?: string;
}

/** Reconstruct the public origin when Next runs behind a TLS/reverse proxy. */
export function publicRequestOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim() || requestUrl.host;
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const protocol = forwardedProtocol === 'http' || forwardedProtocol === 'https'
    ? forwardedProtocol
    : requestUrl.protocol.slice(0, -1);

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return requestUrl.origin;
  }
}

export function csrfRejectionReason(input: RequestSecurityInput): string | undefined {
  if (!MUTATION_METHODS.has(input.method.toUpperCase())) return undefined;

  const fetchSite = input.fetchSiteHeader?.trim().toLowerCase();
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return 'cross-site fetch metadata';
  }

  const origin = input.originHeader?.trim();
  if (origin) {
    try {
      if (new URL(origin).origin !== input.requestOrigin) return 'origin mismatch';
    } catch {
      return 'invalid origin';
    }
    return undefined;
  }

  if (STRICT_ENVIRONMENTS.has((input.appEnvironment ?? '').trim().toUpperCase())) {
    return 'missing origin';
  }
  return fetchSite ? 'missing origin' : undefined;
}
