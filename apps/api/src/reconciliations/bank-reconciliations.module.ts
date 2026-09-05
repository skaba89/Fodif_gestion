import { Module } from '@nestjs/common';
import { IdempotencyService } from '../common/idempotency.service';
import { BankReconciliationsController } from './bank-reconciliations.controller';
import { BankReconciliationsRepository } from './bank-reconciliations.repository';
import { BankReconciliationsService } from './bank-reconciliations.service';

@Module({
  controllers: [BankReconciliationsController],
  providers: [BankReconciliationsRepository, BankReconciliationsService, IdempotencyService],
})
export class BankReconciliationsModule {}
