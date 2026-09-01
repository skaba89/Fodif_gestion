import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('companies')
@ApiBearerAuth()
@RequireRoles('PME')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get('me')
  @RequirePermissions('company.own.read')
  getOwn(@Req() request: AuthenticatedRequest) {
    return this.companies.getOwn(request.user);
  }

  @Patch('me')
  @RequirePermissions('company.own.update')
  updateOwn(@Req() request: AuthenticatedRequest, @Body() dto: UpdateCompanyDto) {
    return this.companies.updateOwn(request.user, dto);
  }
}
