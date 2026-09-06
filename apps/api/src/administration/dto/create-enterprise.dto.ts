import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateEnterpriseDto {
  @ApiProperty({ example: 'PME-0001' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'codeFodip contains invalid characters' })
  codeFodip!: string;

  @ApiProperty({ example: 'Entreprise Exemple SARL' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  raisonSociale!: string;

  @ApiPropertyOptional({ example: 'Entreprise Exemple' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomCommercial?: string;
}
