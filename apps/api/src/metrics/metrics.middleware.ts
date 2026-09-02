import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Records every HTTP request's duration into fodip_api_http_request_duration_seconds (axe C3b).
 * A middleware, not an interceptor: an interceptor's RxJS pipe sees an error the moment a handler
 * throws, before AllExceptionsFilter has translated it into a status code, so response.statusCode
 * would still read Express's default (200) for every failed request. Listening for the response's
 * own 'finish' event instead waits until after the exception filter has actually written the
 * final status - correct for both successful and failed requests alike, and the standard pattern
 * for Express HTTP metrics (e.g. express-prom-bundle) for exactly this reason.
 *
 * request.route is read inside that same 'finish' callback, not in the middleware body: as global
 * middleware this runs before Nest's router matches a controller route, so route would still be
 * undefined if read synchronously here - by the time 'finish' fires the request has been fully
 * routed and handled.
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    response.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      // Matched pattern (e.g. "/api/v1/administration/users/:id"), never the raw URL: a raw URL
      // creates one label value per UUID/id (or, for a request that never matched any route at
      // all, one per distinct bad path an attacker or a broken client happens to send) - exactly
      // the unbounded-cardinality mistake Prometheus histograms are documented to warn against.
      const route = request.route?.path ?? 'unmatched';
      this.metrics.httpRequestDuration.observe(
        { method: request.method, route, status_code: String(response.statusCode) },
        durationSeconds,
      );
    });
    next();
  }
}
