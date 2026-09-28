import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// Institutional-readiness audit (2026-09): issue #142's Partenaire bancaire checklist calls for
// a "portefeuille filtrable". `financement.statut` has no real lifecycle in this codebase today
// (set to 'ACTIF' at creation and never transitioned elsewhere - see FinancingsRepository/Service),
// so a statut filter would be decorative; search + date range are what actually lets a partner
// narrow down their own scope.
export class ListPartnerFinancingsDto extends PaginationQueryDto {
  // Matches numero_financement, numero_dossier or raison_sociale (ILIKE, case-insensitive substring)
  // - a partner rarely knows the internal UUID, but always knows the client name or a reference.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
