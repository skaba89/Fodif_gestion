import { IsString, MaxLength } from 'class-validator';

export class OidcExchangeDto {
  @IsString()
  @MaxLength(2000)
  token!: string;
}
