import { proxyWithSession } from '../../../../../../lib/backend';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyWithSession(`/agent/applications/${encodeURIComponent(id)}/claim`, { method: 'POST' });
}
