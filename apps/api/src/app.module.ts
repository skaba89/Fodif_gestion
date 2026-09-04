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
import { PostgresThrottlerStorageService } from './common/postgres-throttler-storage.service';
import { RevocationModule } from './common/revocation/revocation.module';
import { DatabaseModule } from './database/database.module';
import { DatabaseService } from './database/database.service';
import { DataRightsModule } from './data-rights/data-rights.module';
import { DocumentsModule } from './documents/documents.module';
import { FinancingsModule } from './financings/financings.module';
import { MetricsModule } from './metrics/metrics.module';
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
    // Axe E4 (docs/14-ROADMAP-SAAS-PREMIUM.md) - PostgreSQL-backed storage
    // (postgres-throttler-storage.service.ts) instead of @nestjs/throttler's default in-memory
    // Map, so the limit holds across multiple API instances behind a load balancer, not just
    // within one process.
    ThrottlerModule.forRootAsync({
      imports: [DatabaseModule],
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
        storage: new PostgresThrottlerStorageService(db),
      }),
    }),
    DatabaseModule,
    RevocationModule,
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
    MetricsModule,
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
