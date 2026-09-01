import { Module } from '@nestjs/common';
import { ProgramsController } from './programs.controller';
import { ProgramsRepository } from './programs.repository';

@Module({
  controllers: [ProgramsController],
  providers: [ProgramsRepository],
})
export class ProgramsModule {}
