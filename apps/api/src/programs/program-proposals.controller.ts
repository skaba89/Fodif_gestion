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
import { ProgramProposalsRepository } from './program-proposals.repository';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('programs')
@ApiBearerAuth()
@Controller('programs')
export class ProgramProposalsController {
  constructor(private readonly proposals: ProgramProposalsRepository) {}

  @Get('references')
  @RequirePermissions('program.read')
  references() {
    return this.proposals.references();
  }

  @Get('proposals')
  @RequirePermissions('program.propose')
  listOwn(@Req() request: AuthenticatedRequest) {
    return this.proposals.listOwn(request.user.sub);
  }

  @Post('proposals')
  @RequirePermissions('program.propose')
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateProgramDto) {
    return this.proposals.create(request.user.sub, dto);
  }

  @Get('proposals/:id')
  @RequirePermissions('program.propose')
  getOwn(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.proposals.getOwn(request.user.sub, id);
  }

  @Patch('proposals/:id')
  @RequirePermissions('program.propose')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.proposals.update(request.user.sub, id, dto);
  }

  @Patch('proposals/:id/versions/:version')
  @RequirePermissions('program.propose')
  updateRules(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: UpdateProgramRuleDto,
  ) {
    return this.proposals.updateRules(request.user.sub, id, version, dto);
  }

  @Post('proposals/:id/versions/:version/submit')
  @RequirePermissions('program.propose')
  submit(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.proposals.submit(request.user.sub, id, version);
  }
}
