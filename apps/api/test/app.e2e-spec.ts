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

  it('GET /api/v1/auth/me is protected by default', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('document upload and download routes are protected by default', async () => {
    const dossierId = '11111111-1111-4111-8111-111111111111';
    const documentId = '22222222-2222-4222-8222-222222222222';
    await request(app.getHttpServer()).post(`/api/v1/documents/applications/${dossierId}`).expect(401);
    await request(app.getHttpServer()).get(`/api/v1/documents/${documentId}/download`).expect(401);
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

  it('POST /api/v1/auth/login validates the payload before database access', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'not-an-email', password: '' }).expect(400);
  });
});
