import { proxyWithSession } from '../../../../../lib/backend';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; return proxyWithSession(`/applications/${encodeURIComponent(id)}`, { method: 'PATCH', body: await request.text() }); }
