import { Module } from '@nestjs/common';
import { CommitteeController } from './committee.controller';
import { CommitteeRepository } from './committee.repository';
import { CommitteeService } from './committee.service';

@Module({
  controllers: [CommitteeController],
  providers: [CommitteeRepository, CommitteeService],
})
export class CommitteeModule {}
