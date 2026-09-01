import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { ProgramsRepository } from './programs.repository';

@ApiTags('programs')
@ApiBearerAuth()
@RequireRoles('PME')
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsRepository) {}

  @Get()
  @RequirePermissions('program.read')
  listActive() {
    return this.programs.listActive();
  }
}
