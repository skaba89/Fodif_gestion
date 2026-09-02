import { proxyWithSession } from '../../../../lib/backend';

export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyWithSession('/data-rights/export');
}
