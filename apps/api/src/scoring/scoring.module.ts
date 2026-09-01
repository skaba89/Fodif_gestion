import { Module } from '@nestjs/common';
import { ScoringController } from './scoring.controller';
import { ScoringRepository } from './scoring.repository';
import { ScoringService } from './scoring.service';

@Module({
  controllers: [ScoringController],
  providers: [ScoringRepository, ScoringService],
  exports: [ScoringRepository],
})
export class ScoringModule {}
