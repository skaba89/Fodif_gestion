import { backendApiUrl, sessionResponseFromBackend } from '../../../../../lib/backend';

export async function POST(request: Request) {
  const body = await request.text();
  const backend = await fetch(backendApiUrl('/auth/mfa/confirm'), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body, cache: 'no-store',
  });
  return sessionResponseFromBackend(backend);
}
