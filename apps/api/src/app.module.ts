import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { AuthorizationGuard } from './common/guards/authorization.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CompaniesModule } from './companies/companies.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    AuthModule,
    CompaniesModule,
    ApplicationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AppModule {}
