import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePartnerBankDto {
  @ApiProperty({ example: 'BANK-01' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'code contains invalid characters' })
  code!: string;

  @ApiProperty({ example: 'Banque Partenaire SA' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  raisonSociale!: string;
}
