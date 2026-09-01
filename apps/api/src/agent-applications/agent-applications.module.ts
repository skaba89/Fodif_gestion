import { Module } from '@nestjs/common';
import { AgentApplicationsController } from './agent-applications.controller';
import { AgentApplicationsRepository } from './agent-applications.repository';
import { AgentApplicationsService } from './agent-applications.service';

@Module({
  controllers: [AgentApplicationsController],
  providers: [AgentApplicationsRepository, AgentApplicationsService],
})
export class AgentApplicationsModule {}
