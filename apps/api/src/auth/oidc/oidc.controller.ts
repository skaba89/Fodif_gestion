import { BadRequestException, Body, Controller, Get, NotFoundException, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { UsersRepository } from '../../users/users.repository';
import { OidcExchangeDto } from '../dto/oidc-exchange.dto';
import { MfaService } from '../mfa/mfa.service';
import { SessionTokenService } from '../session-token.service';
import { isOidcPortal, OIDC_FLOW_COOKIE, OidcPortal, OidcService } from './oidc.service';

const FLOW_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

@ApiTags('auth')
@Controller('auth/oidc')
export class OidcController {
  constructor(
    private readonly oidc: OidcService,
    private readonly users: UsersRepository,
    private readonly mfa: MfaService,
    private readonly sessions: SessionTokenService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Whether OIDC sign-in is configured' })
  status() {
    return { enabled: this.oidc.isEnabled() };
  }

  @Public()
  @Get('login')
  @ApiOperation({ summary: 'Redirect to the configured identity provider' })
  async login(@Query('portal') portalParam: string | undefined, @Res() response: Response): Promise<void> {
    if (!this.oidc.isEnabled()) throw new NotFoundException();
    if (!isOidcPortal(portalParam)) throw new BadRequestException('Unknown or missing portal');

    const { url, flowCookie } = await this.oidc.beginAuthorization(portalParam);
    response.cookie(OIDC_FLOW_COOKIE, flowCookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      path: '/api/v1/auth/oidc',
      maxAge: FLOW_COOKIE_MAX_AGE_MS,
    });
    response.redirect(url);
  }

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'Identity provider redirects back here after sign-in' })
  async callback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const webBaseUrl = this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000';
    response.clearCookie(OIDC_FLOW_COOKIE, { path: '/api/v1/auth/oidc' });

    if (!this.oidc.isEnabled()) throw new NotFoundException();

    let portal: OidcPortal | undefined;
    try {
      const cookies = request.cookies as Record<string, string | undefined> | undefined;
      const currentUrl = this.oidc.buildCurrentUrl(request.originalUrl);
      const result = await this.oidc.completeAuthorization(currentUrl, cookies?.[OIDC_FLOW_COOKIE]);
      portal = result.portal;

      const user = await this.users.findForAuthentication(result.email);
      if (!user || !user.actif) {
        response.redirect(`${webBaseUrl}${this.oidc.loginPathFor(portal)}?oidc_error=account_not_found`);
        return;
      }

      const token = await this.oidc.issueDeliveryToken(user.id);
      response.redirect(`${webBaseUrl}${this.oidc.loginPathFor(portal)}?oidc_token=${encodeURIComponent(token)}`);
    } catch {
      const path = portal ? this.oidc.loginPathFor(portal) : '/agent/connexion';
      response.redirect(`${webBaseUrl}${path}?oidc_error=login_failed`);
    }
  }

  @Public()
  @Post('exchange')
  @ApiOperation({ summary: 'Redeem a delivery token from the OIDC callback for a session or MFA challenge' })
  async exchange(@Body() dto: OidcExchangeDto) {
    const userId = await this.oidc.resolveDeliveryToken(dto.token);
    const user = await this.users.findAuthenticatedById(userId);
    if (!user || !user.actif) throw new UnauthorizedException('Invalid or expired sign-in session');

    if (user.mfaRequired) return this.mfa.beginChallenge(user);
    return this.sessions.issue(user);
  }
}
