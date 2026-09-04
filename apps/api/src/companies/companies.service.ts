import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { requireEnterpriseScope } from '../pme-policy';
import { CompaniesRepository } from './companies.repository';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly companies: CompaniesRepository) {}

  private entrepriseId(user: AuthenticatedUser): string {
    if (!requireEnterpriseScope(user) || !user.entrepriseId) {
      throw new ForbiddenException('Enterprise scope is required');
    }
    return user.entrepriseId;
  }

  async getOwn(user: AuthenticatedUser) {
    const company = await this.companies.findById(this.entrepriseId(user));
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateOwn(user: AuthenticatedUser, dto: UpdateCompanyDto) {
    const result = await this.companies.updateById(this.entrepriseId(user), dto);
    switch (result.outcome) {
      case 'NOT_FOUND':
        throw new NotFoundException('Company not found');
      case 'VERSION_CONFLICT':
        // Axe E5 (verrouillage optimiste, docs/14-ROADMAP-SAAS-PREMIUM.md): someone else's write
        // landed after this edit was loaded - never silently overwritten.
        throw new ConflictException(
          'This company profile was updated by someone else since you loaded it. Reload the latest version before saving again.',
        );
      case 'OK':
        return result.company;
    }
  }
}
