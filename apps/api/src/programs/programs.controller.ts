import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CreateProgramDto, UpdateProgramDto, UpdateProgramRuleDto } from './dto/program.dto';
import { ProgramsRepository } from './programs.repository';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('programs')
@ApiBearerAuth()
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsRepository) {}

  @Get()
  @RequirePermissions('program.read')
  listActive() {
    return this.programs.listActive();
  }

  @Get('management')
  @RequirePermissions('program.manage')
  listManagement() {
    return this.programs.listManagement();
  }

  @Post('management')
  @RequirePermissions('program.manage')
  createProgram(@Req() request: AuthenticatedRequest, @Body() dto: CreateProgramDto) {
    return this.programs.createProgram(request.user.sub, dto);
  }

  @Get('management/:id')
  @RequirePermissions('program.manage')
  getManagement(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.programs.getManagement(id);
  }

  @Patch('management/:id')
  @RequirePermissions('program.manage')
  updateProgram(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.programs.updateProgram(request.user.sub, id, dto);
  }

  @Post('management/:id/versions')
  @RequirePermissions('program.manage')
  createDraftVersion(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.programs.createDraftVersion(request.user.sub, id);
  }

  @Patch('management/:id/versions/:version')
  @RequirePermissions('program.manage')
  updateDraftVersion(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: UpdateProgramRuleDto,
  ) {
    return this.programs.updateDraftVersion(request.user.sub, id, version, dto);
  }

  @Post('management/:id/versions/:version/submit')
  @RequirePermissions('program.manage')
  submitVersion(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.programs.submitVersion(request.user.sub, id, version);
  }

  @Post('management/:id/versions/:version/approve')
  @RequirePermissions('program.approve')
  approveVersion(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.programs.approveVersion(request.user.sub, id, version);
  }

  @Post('management/:id/versions/:version/activate')
  @RequirePermissions('program.approve')
  activateVersion(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.programs.activateVersion(request.user.sub, id, version);
  }

  @Get(':id')
  @RequirePermissions('program.read')
  getActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.programs.getActive(id);
  }
}
