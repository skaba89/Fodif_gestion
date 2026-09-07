import {
  trackAuthenticatedSession,
  trackLoginByEmail,
  trackMfaByChallenge,
} from '../src/common/throttle-tracker';

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

describe('trackAuthenticatedSession', () => {
  it('uses a stable irreversible bucket for one bearer-token session', () => {
    const request = {
      headers: { authorization: '  Bearer test-session-token  ' },
      ip: '10.0.0.1',
    };

    const first = trackAuthenticatedSession(request);
    const second = trackAuthenticatedSession({
      headers: { authorization: 'Bearer test-session-token' },
      ip: '10.0.0.99',
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^session:[a-f0-9]{64}$/);
    expect(first).not.toContain('test-session-token');
  });

  it('gives different authenticated sessions independent buckets', () => {
    const first = trackAuthenticatedSession({
      headers: { authorization: 'Bearer session-a' },
      ip: '10.0.0.1',
    });
    const second = trackAuthenticatedSession({
      headers: { authorization: 'Bearer session-b' },
      ip: '10.0.0.1',
    });

    expect(first).not.toBe(second);
  });

  it('falls back to the caller IP when no authorization header is usable', () => {
    expect(trackAuthenticatedSession({ headers: {}, ip: '10.0.0.7' })).toBe('ip:10.0.0.7');
    expect(trackAuthenticatedSession({ headers: { authorization: 123 }, ip: '10.0.0.8' })).toBe(
      'ip:10.0.0.8',
    );
    expect(trackAuthenticatedSession({})).toBe('ip:unknown');
  });
});
