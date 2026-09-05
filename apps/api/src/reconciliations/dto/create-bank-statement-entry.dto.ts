import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateBankStatementEntryDto {
  @IsUUID()
  banqueId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  referenceExterne!: string;

  @IsDateString()
  dateOperation!: string;

  @IsOptional()
  @IsDateString()
  dateValeur?: string;

  @IsIn(['DEBIT', 'CREDIT'])
  sens!: 'DEBIT' | 'CREDIT';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montant!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  libelle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lotImport?: string;
}
