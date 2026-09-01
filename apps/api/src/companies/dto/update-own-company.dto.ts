import { IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateOwnCompanyDto {
  @IsOptional() @IsString() @MaxLength(255) raisonSociale?: string;
  @IsOptional() @IsString() @MaxLength(255) nomCommercial?: string;
  @IsOptional() @IsString() @MaxLength(100) rccm?: string;
  @IsOptional() @IsString() @MaxLength(100) nif?: string;
  @IsOptional() @IsString() @MaxLength(100) formeJuridique?: string;
  @IsOptional() @IsString() @MaxLength(200) secteur?: string;
  @IsOptional() @IsInt() @Min(0) nombreEmployes?: number;
  @IsOptional() @IsString() @MaxLength(150) region?: string;
  @IsOptional() @IsString() @MaxLength(150) prefecture?: string;
  @IsOptional() @IsString() @MaxLength(50) telephone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(3000) descriptionActivite?: string;
}
