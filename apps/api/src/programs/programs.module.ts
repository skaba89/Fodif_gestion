import { Module } from '@nestjs/common';
import { ProgramProposalsController } from './program-proposals.controller';
import { ProgramProposalsRepository } from './program-proposals.repository';
import { ProgramsController } from './programs.controller';
import { ProgramsRepository } from './programs.repository';

@Module({
  // Specific /references and /proposals routes are registered before the generic /:id route.
  controllers: [ProgramProposalsController, ProgramsController],
  providers: [ProgramsRepository, ProgramProposalsRepository],
})
export class ProgramsModule {}
