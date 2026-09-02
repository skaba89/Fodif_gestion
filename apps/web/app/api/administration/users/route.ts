import { proxyWithSession } from '../../../../lib/backend';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  return proxyWithSession(`/administration/users${query}`);
}

export async function POST(request: Request) {
  return proxyWithSession('/administration/users', { method: 'POST', body: await request.text() });
}

