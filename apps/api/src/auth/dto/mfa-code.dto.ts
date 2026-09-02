import { IsString, Matches, MaxLength } from 'class-validator';

export class MfaCodeDto {
  @IsString()
  @MaxLength(2000)
  mfaChallenge!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit TOTP token' })
  code!: string;
}
