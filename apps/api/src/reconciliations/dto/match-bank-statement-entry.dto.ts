import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class MatchBankStatementEntryDto {
  @IsIn(['DECAISSEMENT', 'REMBOURSEMENT'])
  operationType!: 'DECAISSEMENT' | 'REMBOURSEMENT';

  @IsUUID()
  operationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}
