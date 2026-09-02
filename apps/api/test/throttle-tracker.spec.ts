import { trackLoginByEmail, trackMfaByChallenge } from '../src/common/throttle-tracker';

describe('trackLoginByEmail', () => {
  it('keys by the normalized email in the request body', () => {
    expect(trackLoginByEmail({ body: { email: '  Admin@Fodip.Local  ' }, ip: '10.0.0.1' })).toBe('admin@fodip.local');
  });

  it('falls back to the caller IP when the body has no usable email', () => {
    expect(trackLoginByEmail({ body: {}, ip: '10.0.0.1' })).toBe('10.0.0.1');
    expect(trackLoginByEmail({ body: { email: 123 }, ip: '10.0.0.1' })).toBe('10.0.0.1');
    expect(trackLoginByEmail({ ip: '10.0.0.1' })).toBe('10.0.0.1');
  });

  it('falls back to a constant placeholder when neither is available', () => {
    expect(trackLoginByEmail({})).toBe('unknown');
  });

  it('gives two different accounts independent buckets', () => {
    const a = trackLoginByEmail({ body: { email: 'a@fodip.local' }, ip: '10.0.0.1' });
    const b = trackLoginByEmail({ body: { email: 'b@fodip.local' }, ip: '10.0.0.1' });
    expect(a).not.toBe(b);
  });
});

describe('trackMfaByChallenge', () => {
  it('keys by the exact challenge token, case preserved (JWTs are base64url, case-sensitive)', () => {
    expect(trackMfaByChallenge({ body: { mfaChallenge: 'Header.Payload.Signature' }, ip: '10.0.0.1' }))
      .toBe('Header.Payload.Signature');
  });

  it('falls back to the caller IP when the body has no usable challenge', () => {
    expect(trackMfaByChallenge({ body: {}, ip: '10.0.0.1' })).toBe('10.0.0.1');
  });

  it('gives two different challenges independent buckets', () => {
    const a = trackMfaByChallenge({ body: { mfaChallenge: 'token-a' }, ip: '10.0.0.1' });
    const b = trackMfaByChallenge({ body: { mfaChallenge: 'token-b' }, ip: '10.0.0.1' });
    expect(a).not.toBe(b);
  });
});
