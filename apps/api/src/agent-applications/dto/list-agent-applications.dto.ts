import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListAgentApplicationsDto {
  @IsOptional()
  @IsIn(['SOUMIS', 'EN_INSTRUCTION', 'COMPLEMENT_REQUIS', 'PRET_COMITE'])
  statut?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recherche?: string;

  @IsOptional()
  @IsIn(['A_PRENDRE', 'MES_DOSSIERS', 'COMPLEMENTS', 'PRET_COMITE', 'HISTORIQUE'])
  vue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 25;
}
