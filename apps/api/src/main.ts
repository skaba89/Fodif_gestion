import './tracing'; // must load first - see tracing.ts

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { JsonLoggerService } from './common/json-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: false,
    // Structured JSON logs in production, where a real log aggregator is the reader; local dev,
    // CI and the Docker demo keep Nest's default human-readable console logger.
    logger: process.env.NODE_ENV === 'production' ? new JsonLoggerService() : undefined,
  });
  const config = app.get(ConfigService);

  // Only ever used to read back the short-lived, httpOnly OIDC flow cookie (auth/oidc) - the API
  // sets no other cookies and never trusts one for authenticating a regular request.
  app.use(cookieParser());
  app.use(
    helmet({
      // This is a pure JSON API; the only HTML it serves is the Swagger UI at
      // /api/docs, which needs inline scripts/styles that a default CSP would
      // block. The remaining helmet protections (HSTS, X-Frame-Options,
      // X-Content-Type-Options, etc.) stay enabled.
      contentSecurityPolicy: false,
    }),
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FODIP Digital 2030 API')
    .setDescription('API transactionnelle de gestion, financement et suivi des PME')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(config.get<string>('PORT') ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
