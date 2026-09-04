import { idempotencyKeyHeaders, proxyWithSession } from '../../../../../../lib/backend';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyWithSession(`/financings/${id}/repayments`, {
    method: 'POST', body: await request.text(), headers: idempotencyKeyHeaders(request),
  });
}
