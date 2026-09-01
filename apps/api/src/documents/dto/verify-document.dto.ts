import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyDocumentDto {
  @IsString()
  @IsIn(['VALIDE', 'REJETE', 'A_COMPLETER'])
  statut!: 'VALIDE' | 'REJETE' | 'A_COMPLETER';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}
