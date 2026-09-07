import { proxyWithSession } from '../../../../lib/backend';

export async function POST(request: Request) {
  return proxyWithSession('/communications/support/assistant', {
    method: 'POST',
    body: await request.text(),
  });
}
