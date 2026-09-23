import { Controller, Get, Headers, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';
import { MetricsAccessService } from './metrics-access.service';

/**
 * Axe C3b/C4: a Prometheus scrape target, not a JSON API response. @Public() bypasses the product
 * JWT/RBAC guards; MetricsAccessService applies the dedicated operational bearer credential in
 * production. Excluded from Swagger: it isn't part of the product API contract, it's an
 * operational endpoint for the metrics backend chosen in axe C4.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService, private readonly access: MetricsAccessService) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  async scrape(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    this.access.assertAuthorized(authorization);
    response.setHeader('Content-Type', this.metrics.contentType);
    response.setHeader('Cache-Control', 'no-store');
    return this.metrics.metrics();
  }
}
