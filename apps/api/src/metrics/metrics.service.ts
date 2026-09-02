import { Injectable } from '@nestjs/common';
import { Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Axe C3b (docs/14-ROADMAP-SAAS-PREMIUM.md): application metrics (latency, throughput, error
 * rate), the raw material axe C4's dashboard reads. A dedicated Registry rather than prom-client's
 * global default one: NestJS test modules (apps/api/test/*.e2e-spec.ts) compile a fresh AppModule
 * - and therefore a fresh MetricsService - per test file; sharing the global registry across
 * those would throw "metric already registered" the second time a suite compiles it. Default
 * Node.js process metrics (CPU, memory, event loop lag, GC) are collected on the same registry -
 * in this prom-client version they sample lazily when scraped, not via a background timer, so
 * there is nothing to leak or unref in a test process.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpRequestDuration: Histogram<'method' | 'route' | 'status_code'>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'fodip_api_' });
    this.httpRequestDuration = new Histogram({
      name: 'fodip_api_http_request_duration_seconds',
      help: 'HTTP request duration in seconds, labelled by method, matched route pattern and status code.',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
