import { proxyWithSession } from '../../../../../../lib/backend';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyWithSession(`/documents/${encodeURIComponent(id)}/verification`, {
    method: 'POST',
    body: await request.text(),
  });
}
