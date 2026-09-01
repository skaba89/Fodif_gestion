import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backendApiUrl } from '../../../../lib/backend';

export async function POST(request: Request) {
  const body = await request.text();
  const backend = await fetch(backendApiUrl('/auth/login'), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body, cache: 'no-store',
  });
  const text = await backend.text();
  const response = new NextResponse(text || null, {
    status: backend.status,
    headers: { 'content-type': backend.headers.get('content-type') ?? 'application/json' },
  });
  if (backend.ok && text) {
    const payload = JSON.parse(text);
    if (payload.accessToken) response.cookies.set(ACCESS_COOKIE, payload.accessToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 15 * 60 });
  }
  return response;
}
