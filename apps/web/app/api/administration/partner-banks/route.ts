import { proxyWithSession } from '../../../../lib/backend';

export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyWithSession('/administration/partner-banks');
}

export async function POST(request: Request) {
  return proxyWithSession('/administration/partner-banks', { method: 'POST', body: await request.text() });
}
