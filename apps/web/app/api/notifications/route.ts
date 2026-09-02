import { proxyWithSession } from '../../../lib/backend';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  return proxyWithSession(`/notifications${query}`);
}

