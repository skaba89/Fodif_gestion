import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/create-application.dto';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('applications')
@ApiBearerAuth()
@RequireRoles('PME')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get('me')
  @RequirePermissions('application.own.read')
  listOwn(@Req() request: AuthenticatedRequest) {
    return this.applications.listOwn(request.user);
  }

  @Post()
  @RequirePermissions('application.own.create')
  createOwn(@Req() request: AuthenticatedRequest, @Body() dto: CreateApplicationDto) {
    return this.applications.createOwn(request.user, dto);
  }

  @Patch(':id')
  @RequirePermissions('application.own.update')
  updateOwn(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applications.updateOwn(request.user, id, dto);
  }

  @Post(':id/submit')
  @RequirePermissions('application.own.submit')
  submitOwn(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.applications.submitOwn(request.user, id);
  }
}
