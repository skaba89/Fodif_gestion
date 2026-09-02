import { EventEmitter } from 'node:events';
import { MetricsMiddleware } from '../src/metrics/metrics.middleware';
import { MetricsService } from '../src/metrics/metrics.service';

// Axe C3b. The middleware (not an interceptor - see its own file comment) reads response.statusCode
// and request.route only inside the 'finish' event callback, after Nest's exception filter has
// had a chance to run - these tests simulate exactly that ordering with a bare EventEmitter rather
// than a real HTTP round trip.
function fakeResponse(statusCode: number) {
  const response = new EventEmitter() as EventEmitter & { statusCode: number };
  response.statusCode = statusCode;
  return response;
}

describe('MetricsMiddleware', () => {
  it('records the matched route pattern and status code once the response finishes', () => {
    const metrics = new MetricsService();
    const observe = jest.spyOn(metrics.httpRequestDuration, 'observe');
    const middleware = new MetricsMiddleware(metrics);
    const request = { method: 'GET', path: '/api/v1/administration/users/abc-123', route: { path: '/api/v1/administration/users/:id' } };
    const response = fakeResponse(200);
    const next = jest.fn();

    middleware.use(request as never, response as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(observe).not.toHaveBeenCalled(); // not yet - only after 'finish'

    response.emit('finish');

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(
      { method: 'GET', route: '/api/v1/administration/users/:id', status_code: '200' },
      expect.any(Number),
    );
  });

  it('falls back to a fixed "unmatched" route label rather than the raw path, to bound cardinality', () => {
    const metrics = new MetricsService();
    const observe = jest.spyOn(metrics.httpRequestDuration, 'observe');
    const middleware = new MetricsMiddleware(metrics);
    // No .route: exactly what Express looks like for a request no controller ever matched.
    const request = { method: 'GET', path: '/api/v1/this-path-does-not-exist' };
    const response = fakeResponse(404);

    middleware.use(request as never, response as never, jest.fn());
    response.emit('finish');

    expect(observe).toHaveBeenCalledWith(
      { method: 'GET', route: 'unmatched', status_code: '404' },
      expect.any(Number),
    );
  });
});
