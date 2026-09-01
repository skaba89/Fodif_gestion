import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { requireEnterpriseScope } from '../pme-policy';
import { ApplicationsRepository } from './applications.repository';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/create-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(private readonly applications: ApplicationsRepository) {}

  private entrepriseId(user: AuthenticatedUser): string {
    if (!requireEnterpriseScope(user) || !user.entrepriseId) {
      throw new ForbiddenException('Enterprise scope is required');
    }
    return user.entrepriseId;
  }

  listOwn(user: AuthenticatedUser) {
    return this.applications.listByEnterprise(this.entrepriseId(user));
  }

  createOwn(user: AuthenticatedUser, dto: CreateApplicationDto) {
    return this.applications.createDraft(this.entrepriseId(user), dto);
  }

  async updateOwn(user: AuthenticatedUser, id: string, dto: UpdateApplicationDto) {
    const application = await this.applications.updateOwned(id, this.entrepriseId(user), dto);
    if (!application) throw new NotFoundException('Editable application not found');
    return application;
  }

  async submitOwn(user: AuthenticatedUser, id: string) {
    const application = await this.applications.submitOwned(id, this.entrepriseId(user), user.sub);
    if (!application) throw new NotFoundException('Submittable application not found');
    return application;
  }
}
