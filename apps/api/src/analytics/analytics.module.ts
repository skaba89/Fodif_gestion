import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { MissingDocumentsAlertService } from './missing-documents-alert.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsRepository, AnalyticsService, MissingDocumentsAlertService],
})
export class AnalyticsModule {}
