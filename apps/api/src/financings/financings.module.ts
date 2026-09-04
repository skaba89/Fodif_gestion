import { Module } from '@nestjs/common';
import { IdempotencyService } from '../common/idempotency.service';
import { FinancingsController } from './financings.controller';
import { FinancingsRepository } from './financings.repository';
import { FinancingsService } from './financings.service';

@Module({
  controllers: [FinancingsController],
  providers: [FinancingsRepository, FinancingsService, IdempotencyService],
})
export class FinancingsModule {}
