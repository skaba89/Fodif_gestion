import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsRepository } from './applications.repository';

@Module({ controllers: [ApplicationsController], providers: [ApplicationsRepository] })
export class ApplicationsModule {}
