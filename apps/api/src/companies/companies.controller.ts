import { Body, Controller, Get, NotFoundException, Patch, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CompaniesRepository } from './companies.repository';
import { UpdateOwnCompanyDto } from './dto/update-own-company.dto';

interface UserRequest extends Request { user: AuthenticatedUser; }

@Controller('me/company')
@Roles('PME')
export class CompaniesController {
  constructor(private readonly companies: CompaniesRepository) {}

  @Get()
  @Permissions('company.own.read')
  async getOwnCompany(@Req() req: UserRequest) {
    const company = await this.companies.findPrincipalForUser(req.user.sub);
    if (!company) throw new NotFoundException('No enterprise linked to this user');
    return company;
  }

  @Patch()
  @Permissions('company.own.update')
  async updateOwnCompany(@Req() req: UserRequest, @Body() dto: UpdateOwnCompanyDto) {
    const company = await this.companies.updatePrincipalForUser(req.user.sub, dto);
    if (!company) throw new NotFoundException('No enterprise linked to this user');
    return company;
  }
}
