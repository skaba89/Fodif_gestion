import { proxyWithSession } from '../../../../lib/backend';

export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyWithSession('/administration/enterprises');
}

export async function POST(request: Request) {
  return proxyWithSession('/administration/enterprises', { method: 'POST', body: await request.text() });
}
