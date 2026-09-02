import { IsDateString } from 'class-validator';

export class CreateFinancingDto {
  @IsDateString()
  dateSignature!: string;

  @IsDateString()
  dateDebut!: string;
}
