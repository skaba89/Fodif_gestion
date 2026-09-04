import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { trackLoginByEmail } from '../common/throttle-tracker';
import { Public } from '../common/decorators/public.decorator';
import { RevocationService } from '../common/revocation/revocation.service';
import { AuthenticatedUser } from './auth-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly revocation: RevocationService,
  ) {}

  @Public()
  // Brute-force guard: 5 attempts per account per minute, well below the global
  // API-wide default throttle configured in AppModule. Keyed by the attempted email rather
  // than the caller's IP - see common/throttle-tracker.ts for why.
  @Throttle({ default: { limit: 5, ttl: 60_000, getTracker: trackLoginByEmail } })
  @Post('login')
  @ApiOperation({ summary: 'Authenticate a user and return an access token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated JWT context' })
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  // Axe E4 (session revocation, docs/14-ROADMAP-SAAS-PREMIUM.md) - revokes the presented token
  // itself (JwtAuthGuard already verified it and populated request.user, jti included), not just
  // the browser's cookie. A token with no jti (issued before this axis) has nothing to revoke -
  // this call is then a harmless no-op, not an error, since the caller's intent ("stop trusting
  // this token") is already impossible to violate once there is no session material left client
  // side either way.
  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the presented access token immediately, before its natural expiry' })
  async logout(@Req() request: AuthenticatedRequest) {
    const user = request.user;
    if (user?.jti && user.exp) {
      await this.revocation.revoke(user.jti, user.sub, user.exp);
    }
  }
}
