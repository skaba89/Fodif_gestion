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
    if (response.status === 401 && typeof window !== 'undefined') window.location.replace('/entrepreneur/connexion');
    throw new ApiError(data?.message ?? 'Une erreur est survenue', response.status);
  }
  return data as T;
}
