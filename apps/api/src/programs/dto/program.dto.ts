import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const PROGRAM_DOCUMENT_TYPES = ['RCCM', 'NIF', 'BUSINESS_PLAN', 'ETATS_FINANCIERS', 'GARANTIE', 'AUTRE'] as const;
export const PROGRAM_LIFECYCLE_STATUSES = ['BROUILLON', 'CLOTURE', 'ARCHIVE'] as const;

export class ProgramDocumentDto {
  @ApiProperty({ example: 'BUSINESS_PLAN' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'code must use uppercase letters, numbers, underscore or dash' })
  code!: string;

  @ApiProperty({ example: "Plan d'affaires" })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  libelle!: string;

  @ApiProperty({ enum: PROGRAM_DOCUMENT_TYPES })
  @IsIn(PROGRAM_DOCUMENT_TYPES)
  typeDocument!: (typeof PROGRAM_DOCUMENT_TYPES)[number];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  obligatoire?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  validiteJours?: number | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  ordreAffichage?: number;
}

export class ProgramRuleDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  montantMin?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  montantMax?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  apportMinPct?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  ancienneteMinMois?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  rccmRequis?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  nifRequis?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  slaInstructionJours?: number | null;

  @ApiPropertyOptional({ type: [ProgramDocumentDto], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramDocumentDto)
  documents?: ProgramDocumentDto[];
}

export class CreateProgramDto extends ProgramRuleDto {
  @ApiProperty({ example: 'PROGRAMME-2026' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'code must use uppercase letters, numbers, underscore or dash' })
  code!: string;

  @ApiProperty({ example: 'Programme de financement PME' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  enveloppeTotale?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateDebut?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateFin?: string | null;
}

export class UpdateProgramDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nom?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  enveloppeTotale?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateDebut?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateFin?: string | null;

  @ApiPropertyOptional({ enum: PROGRAM_LIFECYCLE_STATUSES })
  @IsOptional()
  @IsIn(PROGRAM_LIFECYCLE_STATUSES)
  statut?: (typeof PROGRAM_LIFECYCLE_STATUSES)[number];
}

export class UpdateProgramRuleDto extends ProgramRuleDto {}
