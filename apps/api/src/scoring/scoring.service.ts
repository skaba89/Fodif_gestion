import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { calculateScore, canScoreApplication } from '../scoring-policy';
import { SaveScoreDto } from './dto/save-score.dto';
import { ScoringRepository } from './scoring.repository';

@Injectable()
export class ScoringService {
  constructor(private readonly scoring: ScoringRepository) {}

  async get(dossierId: string) {
    const application = await this.scoring.findApplication(dossierId);
    if (!application) throw new NotFoundException('Application not found');
    const model = await this.scoring.getActiveModel();
    if (!model) throw new NotFoundException('Active scoring model not found');
    return { modele: model, score: await this.scoring.getScore(dossierId) };
  }

  async calculate(user: AuthenticatedUser, dossierId: string, dto: SaveScoreDto) {
    const application = await this.scoring.findApplication(dossierId);
    if (!application) throw new NotFoundException('Application not found');
    if (!canScoreApplication(user, application)) {
      throw new ForbiddenException('Only the assigned agent can score an application in instruction');
    }
    const model = await this.scoring.getActiveModel();
    if (!model) throw new NotFoundException('Active scoring model not found');
    try {
      const score = calculateScore(model.criteres, dto.criteres);
      return this.scoring.save(dossierId, model.id, user.sub, score);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid scoring payload');
    }
  }
}
