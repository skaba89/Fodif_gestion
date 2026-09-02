import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApplicationsModule } from './applications/applications.module';
import { AdministrationModule } from './administration/administration.module';
import { AgentApplicationsModule } from './agent-applications/agent-applications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { CommitteeModule } from './committee/committee.module';
import { AuthorizationGuard } from './common/guards/authorization.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DatabaseModule } from './database/database.module';
import { DataRightsModule } from './data-rights/data-rights.module';
import { DocumentsModule } from './documents/documents.module';
import { FinancingsModule } from './financings/financings.module';
import { HealthController } from './health/health.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { PartnerModule } from './partner/partner.module';
import { ProgramsModule } from './programs/programs.module';
import { ScoringModule } from './scoring/scoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    // Global request budget (defense-in-depth). Sensitive routes such as
    // /auth/login override this with a stricter per-route @Throttle().
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    DatabaseModule,
    AdministrationModule,
    AuthModule,
    CompaniesModule,
    CommitteeModule,
    ApplicationsModule,
    AgentApplicationsModule,
    AnalyticsModule,
    AuditModule,
    DataRightsModule,
    DocumentsModule,
    FinancingsModule,
    NotificationsModule,
    PartnerModule,
    ProgramsModule,
    ScoringModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
