import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

const DOSSIER_STATUSES = [
  'BROUILLON', 'SOUMIS', 'EN_INSTRUCTION', 'COMPLEMENT_REQUIS',
  'PRET_COMITE', 'APPROUVE', 'REJETE', 'ANNULE',
] as const;

export class DashboardQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer sur une région' })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer sur un programme FODIP' })
  @IsOptional()
  @IsUUID()
  programmeId?: string;

  // Additive - mission "présentation Directeur général" (feat/dg-premium-presentation, section 3
  // "Filtres et analyses"): secteur/banque/statut/période, on top of the region/programme filters
  // this endpoint already had. Every field stays optional and every existing caller (region- or
  // programme-only) keeps working unchanged.
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer sur un secteur d’activité' })
  @IsOptional()
  @IsUUID()
  secteurId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer sur une banque partenaire' })
  @IsOptional()
  @IsUUID()
  banqueId?: string;

  @ApiPropertyOptional({ enum: DOSSIER_STATUSES, description: 'Filtrer sur le statut des dossiers' })
  @IsOptional()
  @IsIn(DOSSIER_STATUSES)
  statut?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Début de période (inclus), format AAAA-MM-JJ' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Fin de période (inclus), format AAAA-MM-JJ' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
