import { idempotencyKeyHeaders, proxyWithSession } from '../../../../lib/backend';

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  return proxyWithSession(`/bank-reconciliations${query}`);
}

export async function POST(request: Request) {
  return proxyWithSession('/bank-reconciliations/entries', {
    method: 'POST', body: await request.text(), headers: idempotencyKeyHeaders(request),
  });
}
