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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/v1/health remains public', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('fodip-api');
  });

  it('GET /api/v1/auth/me is protected by default', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('PME company and application endpoints are protected by default', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/company').expect(401);
    await request(app.getHttpServer()).get('/api/v1/me/applications').expect(401);
    await request(app.getHttpServer()).post('/api/v1/me/applications').send({}).expect(401);
  });

  it('POST /api/v1/auth/login validates the payload before database access', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'not-an-email', password: '' }).expect(400);
  });
});
