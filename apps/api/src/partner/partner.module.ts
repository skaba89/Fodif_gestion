import { Module } from '@nestjs/common';
import { IdempotencyService } from '../common/idempotency.service';
import { PartnerController } from './partner.controller';
import { PartnerRepository } from './partner.repository';
import { PartnerService } from './partner.service';

@Module({
  controllers: [PartnerController],
  providers: [PartnerRepository, PartnerService, IdempotencyService],
})
export class PartnerModule {}
