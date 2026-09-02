import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { AdministrationService } from './administration.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('administration')
@ApiBearerAuth()
@RequireRoles('SUPER_ADMIN')
@Controller('administration')
export class AdministrationController {
  constructor(private readonly administration: AdministrationService) {}

  @Get('users')
  @RequirePermissions('user.manage')
  listUsers(@Query('search') search?: string) { return this.administration.listUsers(search); }

  @Post('users')
  @RequirePermissions('user.manage')
  createUser(@Req() request: AuthenticatedRequest, @Body() dto: CreateUserDto) {
    return this.administration.createUser(request.user.sub, dto);
  }

  @Patch('users/:id')
  @RequirePermissions('user.manage')
  updateUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ) { return this.administration.updateUser(request.user.sub, id, dto); }

  @Get('roles')
  @RequirePermissions('role.read')
  listRoles() { return this.administration.listRoles(); }

  @Get('enterprises')
  @RequirePermissions('user.manage')
  listEnterprises() { return this.administration.listEnterprises(); }

  @Get('partner-banks')
  @RequirePermissions('user.manage')
  listPartnerBanks() { return this.administration.listPartnerBanks(); }
}

