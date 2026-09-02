import { proxyWithSession } from '../../../../../lib/backend';

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyWithSession(`/notifications/${id}/read`, { method: 'PATCH' });
}

