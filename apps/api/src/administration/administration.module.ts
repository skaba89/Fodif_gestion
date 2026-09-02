import { Module } from '@nestjs/common';
import { AdministrationController } from './administration.controller';
import { AdministrationRepository } from './administration.repository';
import { AdministrationService } from './administration.service';

@Module({ controllers: [AdministrationController], providers: [AdministrationRepository, AdministrationService] })
export class AdministrationModule {}

