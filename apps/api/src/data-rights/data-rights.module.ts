import { Module } from '@nestjs/common';
import { DataRightsController } from './data-rights.controller';
import { DataRightsRepository } from './data-rights.repository';
import { DataRightsService } from './data-rights.service';

@Module({
  controllers: [DataRightsController],
  providers: [DataRightsRepository, DataRightsService],
})
export class DataRightsModule {}
