/**
 * Axe E4 (docs/14-ROADMAP-SAAS-PREMIUM.md) - JWT signing key rotation, end to end against the
 * real running app (no mocked guard/resolver, unlike jwt-auth.guard.spec.ts and
 * jwt-key-resolver.service.spec.ts). Proves the actual operational promise: rotating JWT_SECRET
 * (moving its old value into JWT_SECRET_PREVIOUS) does not immediately invalidate tokens already
 * handed out, and clearing JWT_SECRET_PREVIOUS once the rotation window is over does.
 *
 * No database is configured (same reason as app.e2e-spec.ts: this only needs the guard and the
 * app's routing, not persisted state) - the token used throughout has no `jti`, so
 * JwtAuthGuard never reaches RevocationService for it.
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { resolveJwtSigningKeys } from '../src/security-policy';

const OLD_SECRET = 'old-jwt-secret-before-rotation-at-least-32-chars';
const NEW_SECRET = 'new-jwt-secret-after-rotation-at-least-32-chars!';

function signWithSecret(secret: string): string {
  // Mirrors exactly what auth.module.ts's JwtModule.registerAsync configures for real signing -
  // same issuer/audience/expiry, and the same `kid` the app itself would have tagged this token
  // with had it actually signed it while `secret` was current (resolveJwtSigningKeys is
  // deterministic - see security-policy.js) - just against an explicit secret rather than the
  // app's current one, to produce a real token "from before the rotation".
  const { currentKid } = resolveJwtSigningKeys(secret, undefined, 'test');
  const jwt = new JwtService({
    secret,
    signOptions: { issuer: 'fodip-digital-2030', audience: 'fodip-web', expiresIn: '15m', keyid: currentKid },
  });
  return jwt.sign({ sub: 'user-1', email: 'pme@fodip.test', roles: ['PME'], permissions: [] });
}

async function bootApp(env: Record<string, string | undefined>): Promise<INestApplication> {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

describe('JWT signing key rotation (real app, no database)', () => {
  const baseEnv = { NODE_ENV: 'test' };
  // This suite runs in the same Jest worker process as every other spec file (jest --runInBand) -
  // restore whatever JWT_SECRET*/NODE_ENV looked like before this file ran so a later spec file
  // never inherits a value only meaningful to these tests.
  const originalEnv = { JWT_SECRET: process.env.JWT_SECRET, JWT_SECRET_PREVIOUS: process.env.JWT_SECRET_PREVIOUS, NODE_ENV: process.env.NODE_ENV };

  afterEach(() => {
    delete process.env.JWT_SECRET_PREVIOUS;
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('accepts a token signed with the previous secret while JWT_SECRET_PREVIOUS names it - the rotation window', async () => {
    const app = await bootApp({ ...baseEnv, JWT_SECRET: NEW_SECRET, JWT_SECRET_PREVIOUS: OLD_SECRET });
    const oldToken = signWithSecret(OLD_SECRET);

    const response = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${oldToken}`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe('pme@fodip.test');
    await app.close();
  });

  it('still accepts a token signed with the current secret during the same rotation window', async () => {
    const app = await bootApp({ ...baseEnv, JWT_SECRET: NEW_SECRET, JWT_SECRET_PREVIOUS: OLD_SECRET });
    const newToken = signWithSecret(NEW_SECRET);

    const response = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${newToken}`);

    expect(response.status).toBe(200);
    await app.close();
  });

  it('rejects the previous-secret token once JWT_SECRET_PREVIOUS is cleared - the rotation window is over', async () => {
    const app = await bootApp({ ...baseEnv, JWT_SECRET: NEW_SECRET, JWT_SECRET_PREVIOUS: undefined });
    const oldToken = signWithSecret(OLD_SECRET);

    const response = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${oldToken}`);

    expect(response.status).toBe(401);
    await app.close();
  });

  it("a legacy token with no kid at all (issued before this axis existed) still verifies against the current secret", async () => {
    const app = await bootApp({ ...baseEnv, JWT_SECRET: NEW_SECRET, JWT_SECRET_PREVIOUS: undefined });
    // Signed with no `keyid` in the options at all - exactly what every token looked like before
    // this axis.
    const jwt = new JwtService({ secret: NEW_SECRET, signOptions: { issuer: 'fodip-digital-2030', audience: 'fodip-web', expiresIn: '15m' } });
    const legacyToken = jwt.sign({ sub: 'user-1', email: 'pme@fodip.test', roles: ['PME'], permissions: [] });

    const response = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${legacyToken}`);

    expect(response.status).toBe(200);
    await app.close();
  });
});
