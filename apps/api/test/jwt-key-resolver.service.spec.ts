import { JwtKeyResolverService } from '../src/auth/jwt-key-resolver.service';

// Axe E4 (docs/14-ROADMAP-SAAS-PREMIUM.md) - JWT signing key rotation.
function configOf(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as never;
}

describe('JwtKeyResolverService', () => {
  it('signs with a deterministic kid derived from JWT_SECRET, with no JWT_SECRET_PREVIOUS set', () => {
    const resolver = new JwtKeyResolverService(configOf({ JWT_SECRET: 'x'.repeat(48), NODE_ENV: 'production' }));

    expect(resolver.signingSecret).toBe('x'.repeat(48));
    expect(resolver.signingKeyId).toMatch(/^[0-9a-f]{8}$/);
  });

  it('resolves the previous secret for its own kid, and the current secret for the current kid', () => {
    const current = 'x'.repeat(48);
    const previous = 'y'.repeat(48);
    const resolver = new JwtKeyResolverService(
      configOf({ JWT_SECRET: current, JWT_SECRET_PREVIOUS: previous, NODE_ENV: 'production' }),
    );
    const currentKid = resolver.signingKeyId;
    const previousOnlyResolver = new JwtKeyResolverService(configOf({ JWT_SECRET: previous, NODE_ENV: 'production' }));
    const previousKid = previousOnlyResolver.signingKeyId;

    expect(resolver.resolveVerificationSecret(currentKid)).toBe(current);
    expect(resolver.resolveVerificationSecret(previousKid)).toBe(previous);
  });

  it('falls back to the current secret for an unrecognized or missing kid - never rejects outright here, verification still checks the signature', () => {
    const resolver = new JwtKeyResolverService(configOf({ JWT_SECRET: 'x'.repeat(48), NODE_ENV: 'production' }));

    expect(resolver.resolveVerificationSecret(undefined)).toBe(resolver.signingSecret);
    expect(resolver.resolveVerificationSecret('not-a-real-kid')).toBe(resolver.signingSecret);
  });

  it('stops accepting the previous secret once JWT_SECRET_PREVIOUS is cleared (the operator ends the rotation window)', () => {
    const current = 'x'.repeat(48);
    const previous = 'y'.repeat(48);
    const duringRotation = new JwtKeyResolverService(
      configOf({ JWT_SECRET: current, JWT_SECRET_PREVIOUS: previous, NODE_ENV: 'production' }),
    );
    const previousKid = new JwtKeyResolverService(configOf({ JWT_SECRET: previous, NODE_ENV: 'production' })).signingKeyId;
    expect(duringRotation.resolveVerificationSecret(previousKid)).toBe(previous);

    const afterRotation = new JwtKeyResolverService(configOf({ JWT_SECRET: current, NODE_ENV: 'production' }));
    // No longer known - falls back to the current secret, so a token still tagged with the old
    // kid now fails signature verification against it (handled by JwtAuthGuard/jsonwebtoken, not
    // this resolver) rather than being silently accepted forever.
    expect(afterRotation.resolveVerificationSecret(previousKid)).toBe(current);
  });
});
