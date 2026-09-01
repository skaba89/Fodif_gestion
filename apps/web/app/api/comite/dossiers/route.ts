import { proxyWithSession } from '../../../../lib/backend';

export async function GET() {
  return proxyWithSession('/committee/applications');
}
