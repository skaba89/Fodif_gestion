import { proxyWithSession } from '../../../../lib/backend';

export async function PATCH() {
  return proxyWithSession('/notifications/read-all', { method: 'PATCH' });
}

