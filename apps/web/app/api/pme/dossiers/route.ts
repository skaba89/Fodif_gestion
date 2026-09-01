import { proxyWithSession } from '../../../../lib/backend';
export async function GET() { return proxyWithSession('/applications/me'); }
export async function POST(request: Request) { return proxyWithSession('/applications', { method: 'POST', body: await request.text() }); }
