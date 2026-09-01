import { IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateApplicationDto {
  @IsUUID() programmeId!: string;
  @IsNumber() @Min(1) montantDemande!: number;
  @IsOptional() @IsNumber() @Min(0) apportPersonnel?: number;
  @IsString() @MaxLength(2000) objetFinancement!: string;
  @IsOptional() @IsString() @MaxLength(10000) descriptionProjet?: string;
  @IsOptional() @IsInt() @Min(0) nombreEmploisPrevus?: number;
}

export class UpdateApplicationDto {
  @IsOptional() @IsUUID() programmeId?: string;
  @IsOptional() @IsNumber() @Min(1) montantDemande?: number;
  @IsOptional() @IsNumber() @Min(0) apportPersonnel?: number;
  @IsOptional() @IsString() @MaxLength(2000) objetFinancement?: string;
  @IsOptional() @IsString() @MaxLength(10000) descriptionProjet?: string;
  @IsOptional() @IsInt() @Min(0) nombreEmploisPrevus?: number;
}
