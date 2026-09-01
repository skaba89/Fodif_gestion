import { proxyWithSession } from '../../../../../../lib/backend';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyWithSession(`/documents/${encodeURIComponent(id)}/download`);
}
