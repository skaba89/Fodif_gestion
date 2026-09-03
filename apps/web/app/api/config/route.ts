import { NextResponse } from 'next/server';

/**
 * Mission "présentation Directeur général", axe 9 (mode présentation) - exposes the server-only
 * `DEMO_MODE` env var (docker-compose.yml / docker-compose.presentation.yml) to client components
 * at request time. Deliberately NOT a `NEXT_PUBLIC_DEMO_MODE` build-time var: this same `web`
 * Docker image serves both the plain local stack and the presentation profile unmodified, and a
 * `NEXT_PUBLIC_*` value gets baked into the client bundle at `next build` time, which would force
 * a second, separately-built image just to flip this one flag. No auth required: this endpoint
 * carries no portfolio data, only a boolean the AppShell uses to decide whether to show the
 * "Données de démonstration" banner.
 */
export async function GET() {
  return NextResponse.json({ demoMode: process.env.DEMO_MODE === 'true' });
}
