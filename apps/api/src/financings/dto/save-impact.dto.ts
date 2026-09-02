import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SaveImpactDto {
  @IsDateString()
  periode!: string;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  chiffreAffaires?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  nombreEmployes?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  emploisFemmes?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  emploisHommes?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  emploisJeunes?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  emploisCrees?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  emploisMaintenus?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  chiffreExport?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  productionLocale?: number;

  @IsOptional() @IsString() @MaxLength(2000)
  commentaire?: string;
}
