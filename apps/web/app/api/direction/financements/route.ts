import { proxyWithSession } from '../../../../lib/backend';

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  return proxyWithSession(`/financings${query}`);
}
