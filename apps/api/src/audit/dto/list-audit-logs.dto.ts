import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// Kept in sync with every INSERT INTO audit_logs across the codebase (administration, agent
// applications, committee, scoring, documents and financings repositories).
const AUDITABLE_ENTITY_TYPES = [
  'UTILISATEUR', 'DOSSIER_FINANCEMENT', 'DOSSIER_DOCUMENT',
  'FINANCEMENT', 'DECAISSEMENT', 'REMBOURSEMENT', 'SUIVI_IMPACT',
] as const;

export class ListAuditLogsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(AUDITABLE_ENTITY_TYPES)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;
}
