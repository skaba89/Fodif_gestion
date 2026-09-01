export async function clientApi<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') window.location.assign('/entrepreneur/connexion');
    throw new Error(data?.message ?? 'Une erreur est survenue');
  }
  return data as T;
}
