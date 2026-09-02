import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateRepaymentDto {
  @IsUUID()
  echeanceId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montant!: number;

  @IsDateString()
  datePaiement!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  referencePaiement?: string;

  @IsOptional()
  @IsString()
  @IsIn(['VIREMENT', 'CHEQUE', 'ESPECES', 'MOBILE_MONEY', 'AUTRE'])
  moyenPaiement?: string;
}
