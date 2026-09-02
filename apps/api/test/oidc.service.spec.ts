import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as client from 'openid-client';
import { OidcService } from '../src/auth/oidc/oidc.service';
import { deriveSecret } from '../src/security-policy';

jest.mock('openid-client', () => ({
  discovery: jest.fn(),
  randomPKCECodeVerifier: jest.fn(() => 'verifier'),
  calculatePKCECodeChallenge: jest.fn(async () => 'challenge'),
  randomState: jest.fn(() => 'state-value'),
  randomNonce: jest.fn(() => 'nonce-value'),
  buildAuthorizationUrl: jest.fn(() => new URL('https://idp.example.org/authorize?state=state-value')),
  authorizationCodeGrant: jest.fn(),
}));

const ENABLED_ENV: Record<string, string> = {
  JWT_SECRET: 'x'.repeat(40),
  NODE_ENV: 'test',
  OIDC_ISSUER_URL: 'https://idp.example.org/realms/fodip',
  OIDC_CLIENT_ID: 'fodip-web',
  OIDC_CLIENT_SECRET: 'client-secret-value',
  OIDC_REDIRECT_URI: 'https://api.example.org/api/v1/auth/oidc/callback',
};

function makeService(env: Record<string, string> = ENABLED_ENV) {
  const config = { get: (key: string) => env[key] } as ConfigService;
  return new OidcService(config, new JwtService());
}

describe('OidcService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('isEnabled', () => {
    it('is false when any required variable is missing', () => {
      expect(makeService({ ...ENABLED_ENV, OIDC_CLIENT_SECRET: '' }).isEnabled()).toBe(false);
      expect(makeService({ JWT_SECRET: 'x'.repeat(40), NODE_ENV: 'test' }).isEnabled()).toBe(false);
    });

    it('is true when all four are set', () => {
      expect(makeService().isEnabled()).toBe(true);
    });
  });

  describe('beginAuthorization', () => {
    it('returns the provider URL and a flow cookie that verifies back to the same state/nonce/verifier/portal', async () => {
      (client.discovery as jest.Mock).mockResolvedValue({ __configuration: true });
      const service = makeService();

      const { url, flowCookie } = await service.beginAuthorization('agent');

      expect(url).toBe('https://idp.example.org/authorize?state=state-value');
      expect(client.buildAuthorizationUrl).toHaveBeenCalledWith(
        { __configuration: true },
        expect.objectContaining({
          redirect_uri: ENABLED_ENV.OIDC_REDIRECT_URI,
          code_challenge: 'challenge',
          code_challenge_method: 'S256',
          state: 'state-value',
          nonce: 'nonce-value',
        }),
      );

      const jwt = new JwtService();
      const decoded = await jwt.verifyAsync(flowCookie, {
        secret: deriveSecret('x'.repeat(40), 'fodip-oidc-flow-v1'),
        audience: 'fodip-oidc-flow',
      });
      expect(decoded).toMatchObject({ state: 'state-value', nonce: 'nonce-value', codeVerifier: 'verifier', portal: 'agent' });
    });
  });

  describe('completeAuthorization', () => {
    async function beginAndGetCookie(service: OidcService) {
      (client.discovery as jest.Mock).mockResolvedValue({ __configuration: true });
      const { flowCookie } = await service.beginAuthorization('comite');
      return flowCookie;
    }

    it('rejects when there is no flow cookie', async () => {
      const service = makeService();
      await expect(service.completeAuthorization(new URL('https://api.example.org/callback'), undefined))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a flow cookie signed for a different purpose (e.g. an MFA challenge)', async () => {
      const service = makeService();
      const foreignToken = await new JwtService().signAsync(
        { sub: 'user-1', purpose: 'mfa_login' },
        { secret: 'unrelated-secret', audience: 'fodip-mfa' },
      );
      await expect(service.completeAuthorization(new URL('https://api.example.org/callback'), foreignToken))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('exchanges the code and returns the verified email and originating portal', async () => {
      const service = makeService();
      const flowCookie = await beginAndGetCookie(service);
      (client.authorizationCodeGrant as jest.Mock).mockResolvedValue({
        claims: () => ({ sub: 'idp-subject', email: 'agent@fodip.local' }),
      });

      const result = await service.completeAuthorization(new URL('https://api.example.org/callback?code=abc&state=state-value'), flowCookie);

      expect(result).toEqual({ email: 'agent@fodip.local', portal: 'comite' });
      expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
        { __configuration: true },
        expect.any(URL),
        { pkceCodeVerifier: 'verifier', expectedState: 'state-value', expectedNonce: 'nonce-value' },
      );
    });

    it('rejects when the identity provider returns no email claim', async () => {
      const service = makeService();
      const flowCookie = await beginAndGetCookie(service);
      (client.authorizationCodeGrant as jest.Mock).mockResolvedValue({ claims: () => ({ sub: 'idp-subject' }) });

      await expect(service.completeAuthorization(new URL('https://api.example.org/callback'), flowCookie))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('delivery tokens', () => {
    it('round-trips a user id', async () => {
      const service = makeService();
      const token = await service.issueDeliveryToken('user-42');
      await expect(service.resolveDeliveryToken(token)).resolves.toBe('user-42');
    });

    it('rejects a token that was not issued as a delivery token', async () => {
      const service = makeService();
      const flowCookie = await (async () => {
        (client.discovery as jest.Mock).mockResolvedValue({ __configuration: true });
        return (await service.beginAuthorization('direction')).flowCookie;
      })();
      await expect(service.resolveDeliveryToken(flowCookie)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('loginPathFor / buildCurrentUrl', () => {
    it('maps every portal to its login page', () => {
      const service = makeService();
      expect(service.loginPathFor('agent')).toBe('/agent/connexion');
      expect(service.loginPathFor('comite')).toBe('/comite/connexion');
      expect(service.loginPathFor('direction')).toBe('/direction/connexion');
      expect(service.loginPathFor('administration')).toBe('/administration/connexion');
    });

    it('reconstructs the full callback URL from a path + query using the configured redirect origin', () => {
      const service = makeService();
      const url = service.buildCurrentUrl('/api/v1/auth/oidc/callback?code=abc&state=xyz');
      expect(url.origin).toBe('https://api.example.org');
      expect(url.searchParams.get('code')).toBe('abc');
    });
  });
});
