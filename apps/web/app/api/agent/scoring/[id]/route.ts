import { proxyWithSession } from '../../../../../lib/backend';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyWithSession(`/scoring/applications/${id}`);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyWithSession(`/scoring/applications/${id}`, { method: 'PUT', body: await request.text() });
}
