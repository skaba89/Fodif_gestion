import { Module } from '@nestjs/common';
import { AgentApplicationsModule } from '../agent-applications/agent-applications.module';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

@Module({
  imports: [AgentApplicationsModule],
  controllers: [AuditController],
  providers: [AuditRepository, AuditService],
})
export class AuditModule {}
