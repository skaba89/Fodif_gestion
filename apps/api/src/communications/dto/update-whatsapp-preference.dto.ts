import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class UpdateWhatsAppPreferenceDto {
  @IsBoolean()
  consent!: boolean;

  @IsOptional()
  @Matches(/^\+[1-9][0-9]{7,14}$/, {
    message: 'telephoneE164 must be a valid E.164 phone number',
  })
  telephoneE164?: string;
}
