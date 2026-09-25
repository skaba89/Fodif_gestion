import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// Kept in sync with every INSERT INTO audit_logs across the codebase (administration, agent
// applications, committee, scoring, documents and financings repositories).
const AUDITABLE_ENTITY_TYPES = [
  'UTILISATEUR', 'DOSSIER_FINANCEMENT', 'DOSSIER_DOCUMENT',
  'FINANCEMENT', 'DECAISSEMENT', 'REMBOURSEMENT', 'SUIVI_IMPACT',
  'MOUVEMENT_BANCAIRE', 'RAPPROCHEMENT_BANCAIRE',
] as const;

export class ListAuditLogsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(AUDITABLE_ENTITY_TYPES)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  // Institutional-readiness audit (2026-09): issue #142's Auditeur checklist calls for
  // "drill-down dossier/financement/opération" and "preuve chronologique d'un dossier ou
  // financement" — an auditor filtering by the exact entity id gets every audit_logs row for
  // that one dossier/financement in chronological order, which is exactly that proof.
  @IsOptional()
  @IsUUID()
  entityId?: string;

  // "recherche par identifiant, acteur et période" — actor search matches email/nom/prenom
  // (ILIKE, case-insensitive substring) rather than requiring the auditor to already know the
  // actor's UUID.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  actorSearch?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
