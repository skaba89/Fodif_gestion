import { Module } from '@nestjs/common';
import { FinancingsController } from './financings.controller';
import { FinancingsRepository } from './financings.repository';
import { FinancingsService } from './financings.service';

@Module({
  controllers: [FinancingsController],
  providers: [FinancingsRepository, FinancingsService],
})
export class FinancingsModule {}
