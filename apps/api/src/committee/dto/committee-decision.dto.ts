import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CommitteeDecisionDto {
  @IsString()
  @IsIn(['APPROUVE', 'REJETE', 'COMPLEMENT_REQUIS'])
  decision!: 'APPROUVE' | 'REJETE' | 'COMPLEMENT_REQUIS';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montantApprouve?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  tauxInteret?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  dureeMois?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  differeMois?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  garanties?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentaire?: string;
}
