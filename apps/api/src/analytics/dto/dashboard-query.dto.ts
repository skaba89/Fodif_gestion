import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer sur une région' })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer sur un programme FODIP' })
  @IsOptional()
  @IsUUID()
  programmeId?: string;
}
