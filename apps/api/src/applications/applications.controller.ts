import { Body, ConflictException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApplicationsRepository } from './applications.repository';
import { CreateOwnApplicationDto } from './dto/create-own-application.dto';

interface UserRequest extends Request { user: AuthenticatedUser; }

@Controller('me/applications')
@Roles('PME')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsRepository) {}

  @Get()
  @Permissions('application.own.read')
  list(@Req() req: UserRequest) { return this.applications.listOwn(req.user.sub); }

  @Post()
  @Permissions('application.own.create')
  async create(@Req() req: UserRequest, @Body() dto: CreateOwnApplicationDto) {
    const created = await this.applications.createDraft(req.user.sub, dto);
    if (!created) throw new NotFoundException('No enterprise linked to this user');
    return created;
  }

  @Post(':id/submit')
  @Permissions('application.own.create')
  async submit(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    const submitted = await this.applications.submitOwn(req.user.sub, id);
    if (!submitted) throw new ConflictException('Application is not an owned editable draft');
    return submitted;
  }
}
