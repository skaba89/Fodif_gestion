import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

/**
 * Structured (one JSON object per line) logger for production. Local/dev/CI keep Nest's default
 * human-readable console logger (see main.ts) - this only replaces it when NODE_ENV=production,
 * where a real log aggregator (CloudWatch, Loki, ...) is the actual reader.
 *
 * When a trace is active (see tracing.ts) the current traceId/spanId are attached to every line,
 * so a log entry can be correlated back to the request/DB-query trace that produced it.
 */
@Injectable()
export class JsonLoggerService implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    // Nest's own internal calls follow log(message, context) and error(message, stack, context):
    // the last argument is the context, and for errors a second-to-last stack may precede it.
    const context = optionalParams.length > 0 ? optionalParams[optionalParams.length - 1] : undefined;
    const stack = level === 'error' && optionalParams.length > 1 ? optionalParams[optionalParams.length - 2] : undefined;
    const span = trace.getActiveSpan()?.spanContext();

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === 'string' ? message : safeStringify(message),
      context: typeof context === 'string' ? context : undefined,
      stack: typeof stack === 'string' ? stack : undefined,
      traceId: span?.traceId,
      spanId: span?.spanId,
    };
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
