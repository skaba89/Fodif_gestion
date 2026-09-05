import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListBankReconciliationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  banqueId?: string;

  @IsOptional()
  @IsIn(['A_RAPPROCHER', 'RAPPROCHE'])
  statut?: 'A_RAPPROCHER' | 'RAPPROCHE';
}
