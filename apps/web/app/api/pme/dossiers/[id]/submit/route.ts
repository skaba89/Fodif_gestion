import { proxyWithSession } from '../../../../../../lib/backend';
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; return proxyWithSession(`/applications/${encodeURIComponent(id)}/submit`, { method: 'POST' }); }
