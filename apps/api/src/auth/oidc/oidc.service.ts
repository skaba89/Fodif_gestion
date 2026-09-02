import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as client from 'openid-client';
import { deriveSecret, resolveJwtSecret } from '../../security-policy';

export const OIDC_PORTALS = ['agent', 'comite', 'direction', 'administration'] as const;
export type OidcPortal = (typeof OIDC_PORTALS)[number];

export function isOidcPortal(value: unknown): value is OidcPortal {
  return typeof value === 'string' && (OIDC_PORTALS as readonly string[]).includes(value);
}

/**
 * Where each portal's login page lives, so the OIDC callback can send the browser back to the
 * right one. Deliberately a fixed, server-side table keyed by a validated enum rather than
 * accepting a path from the client - the only alternative would be an open-redirect surface.
 */
const LOGIN_PATH: Record<OidcPortal, string> = {
  agent: '/agent/connexion',
  comite: '/comite/connexion',
  direction: '/direction/connexion',
  administration: '/administration/connexion',
};

export const OIDC_FLOW_COOKIE = 'fodip_oidc_flow';
const FLOW_TTL_SECONDS = 10 * 60;
const DELIVERY_TTL_SECONDS = 2 * 60;
const FLOW_AUDIENCE = 'fodip-oidc-flow';
const DELIVERY_AUDIENCE = 'fodip-oidc-delivery';

interface FlowPayload {
  state: string;
  nonce: string;
  codeVerifier: string;
  portal: OidcPortal;
}

interface DeliveryPayload {
  sub: string;
}

/**
 * OpenID Connect login for institutional accounts (docs/14-ROADMAP-SAAS-PREMIUM.md, axe B4).
 * Tested against Keycloak (open source, self-hostable) but speaks plain OpenID Connect - any
 * spec-compliant IdP works without code changes.
 *
 * This is a second AUTHENTICATION method for an EXISTING account, never a provisioning path: the
 * IdP only ever proves "this email belongs to whoever is signing in" (via its verified ID token),
 * it never creates an account or grants a role - those still come exclusively from
 * /administration/utilisateurs. An OIDC sign-in for an email with no matching active local
 * account is rejected. Accounts flagged mfa_required (see admin-policy.js#PRIVILEGED_ROLES,
 * enforced regardless of login method by AdministrationRepository) still go through our own TOTP
 * check after OIDC identity is established - the IdP is not trusted to have enforced that itself.
 *
 * Entirely opt-in: every method throws/no-ops unless OIDC_ISSUER_URL, OIDC_CLIENT_ID,
 * OIDC_CLIENT_SECRET and OIDC_REDIRECT_URI are all configured.
 */
@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private readonly flowSecret: Buffer;
  private readonly deliverySecret: Buffer;
  private readonly issuerUrl?: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri?: string;
  private configuration: Promise<client.Configuration> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    const jwtSecret = resolveJwtSecret(config.get<string>('JWT_SECRET'), config.get<string>('NODE_ENV'));
    this.flowSecret = deriveSecret(jwtSecret, 'fodip-oidc-flow-v1');
    this.deliverySecret = deriveSecret(jwtSecret, 'fodip-oidc-delivery-v1');
    this.issuerUrl = config.get<string>('OIDC_ISSUER_URL') || undefined;
    this.clientId = config.get<string>('OIDC_CLIENT_ID') || undefined;
    this.clientSecret = config.get<string>('OIDC_CLIENT_SECRET') || undefined;
    this.redirectUri = config.get<string>('OIDC_REDIRECT_URI') || undefined;
  }

  isEnabled(): boolean {
    return Boolean(this.issuerUrl && this.clientId && this.clientSecret && this.redirectUri);
  }

  loginPathFor(portal: OidcPortal): string {
    return LOGIN_PATH[portal];
  }

  /** Reconstructs the full callback URL from Express's `request.originalUrl` (path + query only)
   * so openid-client can read `code`/`state`/`iss` off it - the origin itself is never checked
   * against anything by the library, but must be syntactically valid, so the configured
   * redirect_uri's own origin is reused rather than trusting the `Host` header. */
  buildCurrentUrl(originalUrl: string): URL {
    return new URL(originalUrl, this.redirectUri);
  }

  /** Builds the redirect to the identity provider and the signed flow cookie value to pair with it. */
  async beginAuthorization(portal: OidcPortal): Promise<{ url: string; flowCookie: string }> {
    const configuration = await this.getConfiguration();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri as string,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    const payload: FlowPayload = { state, nonce, codeVerifier, portal };
    const flowCookie = await this.jwtService.signAsync(payload, {
      secret: this.flowSecret,
      expiresIn: FLOW_TTL_SECONDS,
      audience: FLOW_AUDIENCE,
    });

    return { url: url.href, flowCookie };
  }

  /**
   * Verifies the callback: the flow cookie (so state/nonce/PKCE were generated by us for this
   * browser), then the authorization response and ID token itself (signature against the IdP's
   * own JWKS, issuer, audience, nonce, state - all handled by openid-client). Returns the
   * verified email and which portal the flow started from.
   */
  async completeAuthorization(currentUrl: URL, flowCookieValue: string | undefined): Promise<{ email: string; portal: OidcPortal }> {
    if (!flowCookieValue) throw new UnauthorizedException('OIDC_FLOW_MISSING');

    let flow: FlowPayload;
    try {
      flow = await this.jwtService.verifyAsync<FlowPayload>(flowCookieValue, {
        secret: this.flowSecret,
        audience: FLOW_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('OIDC_FLOW_INVALID');
    }

    const configuration = await this.getConfiguration();
    const tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
      pkceCodeVerifier: flow.codeVerifier,
      expectedState: flow.state,
      expectedNonce: flow.nonce,
    });

    const claims = tokens.claims();
    const email = claims && typeof claims.email === 'string' ? claims.email : undefined;
    if (!email) {
      this.logger.warn('OIDC identity provider did not return an email claim');
      throw new UnauthorizedException('OIDC_EMAIL_MISSING');
    }

    return { email, portal: flow.portal };
  }

  /** Short-lived, single-purpose reference handed to the browser via redirect (like an OAuth
   * authorization code): carries no session material itself, just "this user id was verified by
   * the IdP a moment ago" - POST /auth/oidc/exchange redeems it for a real session/MFA challenge. */
  issueDeliveryToken(userId: string): Promise<string> {
    const payload: DeliveryPayload = { sub: userId };
    return this.jwtService.signAsync(payload, {
      secret: this.deliverySecret,
      expiresIn: DELIVERY_TTL_SECONDS,
      audience: DELIVERY_AUDIENCE,
    });
  }

  async resolveDeliveryToken(token: string): Promise<string> {
    try {
      const payload = await this.jwtService.verifyAsync<DeliveryPayload>(token, {
        secret: this.deliverySecret,
        audience: DELIVERY_AUDIENCE,
      });
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired sign-in session');
    }
  }

  private async getConfiguration(): Promise<client.Configuration> {
    if (!this.isEnabled()) throw new UnauthorizedException('OIDC_NOT_CONFIGURED');
    if (!this.configuration) {
      this.configuration = client
        .discovery(new URL(this.issuerUrl as string), this.clientId as string, this.clientSecret as string)
        .catch((error: unknown) => {
          // Don't cache a failed discovery forever - a transient IdP outage shouldn't require a restart.
          this.configuration = null;
          throw error;
        });
    }
    return this.configuration;
  }
}
