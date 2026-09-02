import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

/**
 * Axe C3b/C4: a Prometheus scrape target, not a JSON API response - @Public() because Prometheus
 * itself never carries a bearer token (matches the same decorator already used by
 * HealthController for the same reason). Excluded from Swagger: it isn't part of the product API
 * contract, it's an operational endpoint for the metrics backend chosen in axe C4.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  async scrape(@Res({ passthrough: true }) response: Response): Promise<string> {
    response.setHeader('Content-Type', this.metrics.contentType);
    response.setHeader('Cache-Control', 'no-store');
    return this.metrics.metrics();
  }
}
