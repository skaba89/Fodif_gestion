import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { trackMfaByChallenge } from '../../common/throttle-tracker';
import { Public } from '../../common/decorators/public.decorator';
import { MfaCodeDto } from '../dto/mfa-code.dto';
import { MfaService } from './mfa.service';

// A brute-force guard on a 6-digit code: 8 attempts per 5 minutes per challenge, well below the
// ~16 000 checks an attacker would need in the worst case within one 5-minute challenge TTL.
// Keyed by the mfaChallenge token itself rather than the caller's IP - see
// common/throttle-tracker.ts for why.
const MFA_CODE_THROTTLE = { default: { limit: 8, ttl: 300_000, getTracker: trackMfaByChallenge } };

@ApiTags('auth')
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Public()
  @Throttle(MFA_CODE_THROTTLE)
  @Post('confirm')
  @ApiOperation({ summary: 'Confirm TOTP enrollment with a first valid code and complete login' })
  confirm(@Body() dto: MfaCodeDto) {
    return this.mfa.confirmEnrollment(dto.mfaChallenge, dto.code);
  }

  @Public()
  @Throttle(MFA_CODE_THROTTLE)
  @Post('verify')
  @ApiOperation({ summary: 'Verify a TOTP code and complete login' })
  verify(@Body() dto: MfaCodeDto) {
    return this.mfa.verifyLogin(dto.mfaChallenge, dto.code);
  }
}
