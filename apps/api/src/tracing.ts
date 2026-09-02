import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

/**
 * Opt-in OpenTelemetry tracing (docs/14-ROADMAP-SAAS-PREMIUM.md, axe C3).
 *
 * Starts only when OTEL_EXPORTER_OTLP_ENDPOINT (or the traces-specific OTEL_EXPORTER_OTLP_TRACES_ENDPOINT)
 * is set - the OTLPTraceExporter reads those same standard OpenTelemetry env vars itself once
 * constructed, so there's no extra config surface to add here. That means zero behavior change,
 * and no attempted network export, in every environment that doesn't set it: local dev, CI, and
 * the Docker demo today all leave this inert.
 *
 * This file must be the very first thing main.ts imports, before @nestjs/core or anything that
 * transitively requires http/express/pg: the instrumentations below work by patching those
 * modules' exports, which only affects code that requires them afterwards.
 */
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

if (endpoint) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'fodip-api' }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation(), new PgInstrumentation()],
  });

  sdk.start();
  process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => undefined);
  });
}
