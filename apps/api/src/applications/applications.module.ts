import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsRepository } from './applications.repository';
import { ApplicationsService } from './applications.service';

@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsRepository, ApplicationsService],
})
export class ApplicationsModule {}
