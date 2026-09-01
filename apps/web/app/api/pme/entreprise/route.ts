import { proxyWithSession } from '../../../../lib/backend';
export async function GET() { return proxyWithSession('/companies/me'); }
export async function PATCH(request: Request) { return proxyWithSession('/companies/me', { method: 'PATCH', body: await request.text() }); }
