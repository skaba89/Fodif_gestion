import { IsDateString, IsEmail, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UpdateCompanyDto {
  // Axe E5 (verrouillage optimiste, docs/14-ROADMAP-SAAS-PREMIUM.md) - the version this edit was
  // based on (as returned by GET /companies/me). Required, not optional: a write that doesn't know
  // what it's overwriting can't be protected.
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MaxLength(255) raisonSociale?: string;
  @IsOptional() @IsString() @MaxLength(255) nomCommercial?: string;
  @IsOptional() @IsString() @MaxLength(100) rccm?: string;
  @IsOptional() @IsString() @MaxLength(100) nif?: string;
  @IsOptional() @IsString() @MaxLength(100) formeJuridique?: string;
  @IsOptional() @IsDateString() dateCreation?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionActivite?: string;
  @IsOptional() @IsInt() @Min(0) nombreEmployes?: number;
  @IsOptional() @IsNumber() @Min(0) chiffreAffairesAnnuel?: number;
  @IsOptional() @IsString() @MaxLength(50) telephone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(255) siteWeb?: string;
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @IsUUID() prefectureId?: string;
  @IsOptional() @IsUUID() communeId?: string;
  @IsOptional() @IsString() @MaxLength(1000) adresse?: string;
}
