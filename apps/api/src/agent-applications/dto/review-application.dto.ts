import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewApplicationDto {
  @IsString()
  @IsIn(['EN_INSTRUCTION', 'COMPLEMENT_REQUIS', 'PRET_COMITE'])
  statut!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  commentaire!: string;
}
