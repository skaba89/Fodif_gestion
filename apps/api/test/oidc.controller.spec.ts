import { OidcController } from '../src/auth/oidc/oidc.controller';

describe('OidcController callback handoff', () => {
  test('hands the one-use credential to the BFF callback, not React', async () => {
    const oidc = {
      isEnabled: jest.fn().mockReturnValue(true),
      buildCurrentUrl: jest.fn().mockReturnValue(new URL('https://api.example/callback?code=code')),
      completeAuthorization: jest.fn().mockResolvedValue({ email: 'agent@example.gov.gn', portal: 'connexion' }),
      issueDeliveryToken: jest.fn().mockResolvedValue('header.payload.signature'),
      loginPathFor: jest.fn().mockReturnValue('/connexion'),
    };
    const users = { findForAuthentication: jest.fn().mockResolvedValue({
      id: 'user-id', actif: true, roles: ['AGENT_FODIP'],
    }) };
    const config = { get: jest.fn((key: string) => key === 'WEB_BASE_URL' ? 'https://fodip.example/' : undefined) };
    const response = { clearCookie: jest.fn(), redirect: jest.fn() };
    const controller = new OidcController(oidc as never, users as never, {} as never, {} as never, config as never);

    await controller.callback(
      { originalUrl: '/api/v1/auth/oidc/callback?code=code', cookies: { fodip_oidc_flow: 'flow' } } as never,
      response as never,
    );
    expect(response.redirect).toHaveBeenCalledWith(
      'https://fodip.example/api/session/oidc/callback?token=header.payload.signature',
    );
    expect(response.redirect.mock.calls[0][0]).not.toContain('oidc_token');
  });
});
