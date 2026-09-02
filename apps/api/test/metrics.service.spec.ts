import { MetricsService } from '../src/metrics/metrics.service';

// Axe C3b (docs/14-ROADMAP-SAAS-PREMIUM.md). Verified against a real, running API and a real
// `promtool check metrics` (prometheus's own linter) during development - this unit-tests the
// behaviour that verification depended on: a dedicated registry (not prom-client's shared global
// one, which would throw "metric already registered" the second time a test file compiles
// AppModule) and the exposition format actually being scrapeable.
describe('MetricsService', () => {
  it('exposes a Prometheus-compatible content type', () => {
    const service = new MetricsService();
    expect(service.contentType).toMatch(/^text\/plain/);
  });

  it('never collides with another instance on a shared global registry', () => {
    // Two AppModule compilations in the same process (e.g. two Nest testing modules within one
    // Jest file) each construct their own MetricsService - this must not throw.
    expect(() => {
      new MetricsService();
      new MetricsService();
    }).not.toThrow();
  });

  it('renders the custom HTTP duration histogram once observed, scoped to its own registry', async () => {
    const service = new MetricsService();
    service.httpRequestDuration.observe({ method: 'GET', route: '/api/v1/health', status_code: '200' }, 0.02);

    const output = await service.metrics();

    expect(output).toContain('fodip_api_http_request_duration_seconds_bucket');
    expect(output).toContain('method="GET"');
    expect(output).toContain('route="/api/v1/health"');
    expect(output).toContain('status_code="200"');
    // Default Node.js process metrics (axe C3b: CPU/memory/event-loop alongside HTTP metrics),
    // collected on the same dedicated registry rather than prom-client's global default one.
    expect(output).toContain('fodip_api_process_cpu_user_seconds_total');
  });
});
