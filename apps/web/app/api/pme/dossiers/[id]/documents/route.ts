import { proxyWithSession } from '../../../../../../lib/backend';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyWithSession(`/documents/applications/${encodeURIComponent(id)}`);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const formData = await request.formData();
  return proxyWithSession(`/documents/applications/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: formData,
  });
}
