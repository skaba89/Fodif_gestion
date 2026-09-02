import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Shared page/limite query params for endpoints listing high-volume, ever-growing collections
 * (dossiers, financements...). Bounds `limite` to 100 so a caller can't force an unbounded scan
 * by passing an arbitrarily large page size. Extend this rather than repeating the two fields.
 */
export class PaginationQueryDto {
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
