import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListCommitteeApplicationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ORDRE_DU_JOUR', 'HISTORIQUE'])
  vue?: 'ORDRE_DU_JOUR' | 'HISTORIQUE';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recherche?: string;

  @IsOptional()
  @IsIn(['FAIBLE', 'MODERE', 'ELEVE'])
  risque?: 'FAIBLE' | 'MODERE' | 'ELEVE';

  @IsOptional()
  @IsIn(['APPROUVE', 'REJETE', 'COMPLEMENT_REQUIS'])
  decision?: 'APPROUVE' | 'REJETE' | 'COMPLEMENT_REQUIS';

  @IsOptional()
  @IsIn(['anciennete', 'montant', 'score'])
  tri?: 'anciennete' | 'montant' | 'score';
}
