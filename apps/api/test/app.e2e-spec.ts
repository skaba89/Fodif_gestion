import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('FODIP API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-ci-only-123456789';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health remains public', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('fodip-api');
  });

  it('GET /api/v1/metrics remains public and exposes a Prometheus scrape (axe C3b)', async () => {
    // Public for the same reason as /health: Prometheus never carries a bearer token.
    const response = await request(app.getHttpServer()).get('/api/v1/metrics').expect(200);
    expect(response.headers['content-type']).toMatch(/^text\/plain/);
    expect(response.text).toContain('fodip_api_http_request_duration_seconds');
    // The GET /api/v1/health call just above is itself one already-recorded request - route is
    // Express's matched pattern including the global prefix (verified against a real running
    // server, not assumed: request.route.path here is "/api/v1/health", not "/health").
    expect(response.text).toContain('route="/api/v1/health"');
  });

  it('GET /api/v1/auth/me is protected by default', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('document upload and download routes are protected by default', async () => {
    const dossierId = '11111111-1111-4111-8111-111111111111';
    const documentId = '22222222-2222-4222-8222-222222222222';
    await request(app.getHttpServer()).post(`/api/v1/documents/applications/${dossierId}`).expect(401);
    await request(app.getHttpServer()).get(`/api/v1/documents/${documentId}/download`).expect(401);
  });

  it('the AUDITEUR oversight endpoint is protected by default (axe B9)', async () => {
    await request(app.getHttpServer()).get('/api/v1/audit/logs').expect(401);
  });

  it('partner bank endpoints are protected by default (axe D1)', async () => {
    const financingId = '33333333-3333-4333-8333-333333333333';
    await request(app.getHttpServer()).get('/api/v1/partner/financings').expect(401);
    await request(app.getHttpServer()).get(`/api/v1/partner/financings/${financingId}`).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/partner/financings/${financingId}/disbursements`).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/partner/financings/${financingId}/repayments`).expect(401);
  });

  it('agent dossier routes are protected by default', async () => {
    const dossierId = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer()).get('/api/v1/agent/applications').expect(401);
    await request(app.getHttpServer()).get(`/api/v1/agent/applications/${dossierId}`).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/agent/applications/${dossierId}/claim`).expect(401);
  });

  it('scoring and committee routes are protected by default', async () => {
    const dossierId = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer()).get(`/api/v1/scoring/applications/${dossierId}`).expect(401);
    await request(app.getHttpServer()).put(`/api/v1/scoring/applications/${dossierId}`).expect(401);
    await request(app.getHttpServer()).get('/api/v1/committee/applications').expect(401);
    await request(app.getHttpServer()).post(`/api/v1/committee/applications/${dossierId}/decision`).expect(401);
  });

  it('Direction analytics route is protected by default', async () => {
    await request(app.getHttpServer()).get('/api/v1/analytics/dashboard').expect(401);
  });

  it('Notifications route is protected by default', async () => {
    await request(app.getHttpServer()).get('/api/v1/notifications').expect(401);
  });

  it('data-rights routes are protected by default (axe B6)', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer()).get('/api/v1/data-rights/export').expect(401);
    await request(app.getHttpServer()).post(`/api/v1/data-rights/users/${userId}/anonymize`).expect(401);
  });

  it('Administration routes are protected by default', async () => {
    await request(app.getHttpServer()).get('/api/v1/administration/users').expect(401);
    await request(app.getHttpServer()).post('/api/v1/administration/users').send({}).expect(401);
  });

  it('financing lifecycle routes are protected by default', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer()).get('/api/v1/financings').expect(401);
    await request(app.getHttpServer()).post(`/api/v1/financings/applications/${id}`).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/financings/${id}/disbursements`).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/financings/${id}/repayments`).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/financings/${id}/impact`).expect(401);
  });

  it('POST /api/v1/auth/login validates the payload before database access', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'not-an-email', password: '' }).expect(400);
  });

  it('MFA challenge routes stay public but reject malformed payloads', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/mfa/confirm').send({ mfaChallenge: 'x', code: 'not-digits' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/auth/mfa/verify').send({ mfaChallenge: 'x', code: 'not-digits' }).expect(400);
  });

  it('MFA challenge routes reject a well-formed but invalid or expired challenge', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/mfa/verify').send({ mfaChallenge: 'not-a-real-token', code: '123456' }).expect(401);
  });

  it('OIDC routes stay public; status reflects it is unconfigured in this environment', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/oidc/status').expect(200);
    expect(response.body).toEqual({ enabled: false });
    await request(app.getHttpServer()).get('/api/v1/auth/oidc/login?portal=agent').expect(404);
    await request(app.getHttpServer()).post('/api/v1/auth/oidc/exchange').send({ token: 'not-a-real-token' }).expect(401);
  });
});
