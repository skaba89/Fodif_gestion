import { proxyWithSession } from '../../../../lib/backend';

type Context = { params: Promise<{ segments?: string[] }> };

async function forward(request: Request, context: Context, method: 'GET' | 'POST' | 'PATCH') {
  const { segments = [] } = await context.params;
  const suffix = segments.length ? `/${segments.map(encodeURIComponent).join('/')}` : '';
  const query = method === 'GET' ? new URL(request.url).search : '';
  const text = method === 'GET' ? '' : await request.text();
  return proxyWithSession(`/programs/proposals${suffix}${query}`, {
    method,
    body: text || undefined,
  });
}

export async function GET(request: Request, context: Context) {
  return forward(request, context, 'GET');
}

export async function POST(request: Request, context: Context) {
  return forward(request, context, 'POST');
}

export async function PATCH(request: Request, context: Context) {
  return forward(request, context, 'PATCH');
}
