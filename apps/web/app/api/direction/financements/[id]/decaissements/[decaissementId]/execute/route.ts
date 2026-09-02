import { proxyWithSession } from '../../../../../../../../lib/backend';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; decaissementId: string }> },
) {
  const { id, decaissementId } = await context.params;
  return proxyWithSession(`/financings/${id}/disbursements/${decaissementId}/execute`, {
    method: 'POST', body: await request.text(),
  });
}
