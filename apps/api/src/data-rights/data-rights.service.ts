import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { DataRightsRepository } from './data-rights.repository';

@Injectable()
export class DataRightsService {
  constructor(private readonly dataRights: DataRightsRepository) {}

  /**
   * Assembles everything the platform holds that is tied to the caller's own account: their
   * profile, and - for a PME account - the enterprise record, its dirigeants and its dossiers.
   * A partner-bank or FODIP-staff account has no entrepriseId, so those sections are simply
   * omitted rather than guessed at from another scope.
   */
  async exportOwnData(user: AuthenticatedUser) {
    const profile = await this.dataRights.exportProfile(user.sub);
    if (!profile) throw new NotFoundException('User not found');

    const entreprise = user.entrepriseId ? await this.dataRights.exportEnterprise(user.entrepriseId) : null;
    const dirigeants = user.entrepriseId ? await this.dataRights.exportDirigeants(user.entrepriseId) : [];
    const dossiers = user.entrepriseId ? await this.dataRights.exportDossiers(user.entrepriseId) : [];

    await this.dataRights.auditExport(user.sub);

    return {
      generatedAt: new Date().toISOString(),
      profile,
      ...(entreprise ? { entreprise, dirigeants, dossiers } : {}),
    };
  }

  async anonymizeUser(actorId: string, targetId: string) {
    const result = await this.dataRights.anonymize(actorId, targetId);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') throw new NotFoundException('User not found');
      if (result.error === 'ALREADY_ANONYMIZED') throw new ConflictException(result.error);
      throw new ForbiddenException(result.error);
    }
    return result;
  }
}
