import { Type } from 'class-transformer';
import { IsDateString, IsNumber, Min } from 'class-validator';

export class PlanDisbursementDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montant!: number;

  @IsDateString()
  datePrevue!: string;
}
