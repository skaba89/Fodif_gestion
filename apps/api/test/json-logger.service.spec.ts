import { JsonLoggerService } from '../src/common/json-logger.service';

function captureWrites(run: () => void): unknown[] {
  const chunks: string[] = [];
  const spy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  });
  try {
    run();
  } finally {
    spy.mockRestore();
  }
  return chunks.map((chunk) => JSON.parse(chunk));
}

describe('JsonLoggerService', () => {
  it('writes one JSON object per line with the level and message', () => {
    const [entry] = captureWrites(() => new JsonLoggerService().log('server started'));
    expect(entry).toMatchObject({ level: 'log', message: 'server started' });
    expect(typeof (entry as { timestamp: string }).timestamp).toBe('string');
  });

  it('treats the last argument as context for a plain log', () => {
    const [entry] = captureWrites(() => new JsonLoggerService().log('server started', 'Bootstrap'));
    expect(entry).toMatchObject({ context: 'Bootstrap' });
  });

  it('treats the last two arguments as stack then context for an error', () => {
    const [entry] = captureWrites(() => new JsonLoggerService().error('boom', 'Error: boom\n at x', 'AuthService'));
    expect(entry).toMatchObject({ level: 'error', message: 'boom', stack: 'Error: boom\n at x', context: 'AuthService' });
  });

  it('serializes a non-string message rather than dropping it', () => {
    const [entry] = captureWrites(() => new JsonLoggerService().warn({ code: 'X' }));
    expect(entry).toMatchObject({ level: 'warn', message: '{"code":"X"}' });
  });

  it('omits context/stack/trace fields entirely when absent, rather than writing null', () => {
    const [entry] = captureWrites(() => new JsonLoggerService().log('no context here'));
    expect(entry).not.toHaveProperty('context');
    expect(entry).not.toHaveProperty('stack');
    expect(entry).not.toHaveProperty('traceId');
  });
});
