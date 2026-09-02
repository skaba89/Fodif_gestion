import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsString, MaxLength, Min, MinLength } from 'class-validator';

/**
 * A partner bank self-reports a payment it already made on FODIP's behalf - unlike Direction's
 * own plan-then-execute workflow (PlanDisbursementDto + ExecuteDisbursementDto), there is no
 * planning step here: the disbursement is recorded as EFFECTUE immediately.
 */
export class CreatePartnerDisbursementDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montant!: number;

  @IsDateString()
  dateEffective!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  referenceBancaire!: string;
}
