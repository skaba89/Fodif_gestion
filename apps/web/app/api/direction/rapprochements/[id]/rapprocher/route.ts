import { idempotencyKeyHeaders, proxyWithSession } from '../../../../../../lib/backend';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyWithSession(`/bank-reconciliations/entries/${id}/match`, {
    method: 'POST', body: await request.text(), headers: idempotencyKeyHeaders(request),
  });
}
