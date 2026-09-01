import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ScoreAnswerDto {
  @IsString()
  @MaxLength(100)
  code!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  scoreObtenu!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}

export class SaveScoreDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreAnswerDto)
  criteres!: ScoreAnswerDto[];
}
