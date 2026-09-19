import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const ADMINISTRATION_AUDIT_ACTIONS = [
  'CREATE_USER', 'UPDATE_USER', 'RESET_USER_PASSWORD', 'RESET_USER_MFA', 'ANONYMIZE_USER',
  'CREATE_ENTERPRISE', 'CREATE_PARTNER_BANK',
] as const;

export class ListAdministrationAuditDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ADMINISTRATION_AUDIT_ACTIONS)
  action?: string;
}
