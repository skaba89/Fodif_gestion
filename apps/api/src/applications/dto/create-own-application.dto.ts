import { IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateOwnApplicationDto {
  @IsOptional() @IsUUID() programmeId?: string;
  @IsNumber() @Min(1) montantDemande!: number;
  @IsOptional() @IsNumber() @Min(0) apportPersonnel?: number;
  @IsString() @MaxLength(1000) objetFinancement!: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionProjet?: string;
  @IsOptional() @IsInt() @Min(0) nombreEmploisPrevus?: number;
}
