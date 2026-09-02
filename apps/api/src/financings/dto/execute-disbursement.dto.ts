import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class ExecuteDisbursementDto {
  @IsDateString()
  dateEffective!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  referenceBancaire!: string;
}
