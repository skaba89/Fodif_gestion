import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { MetricsAccessService } from '../src/metrics/metrics-access.service';

function service(values: Record<string, string | undefined>) {
  return new MetricsAccessService({ get: (key: string) => values[key] } as ConfigService);
}

describe('MetricsAccessService', () => {
  it('fails startup when a production runtime has no strong scrape credential', () => {
    expect(() => service({ NODE_ENV: 'production' })).toThrow(/METRICS_TOKEN/);
    expect(() => service({ NODE_ENV: 'production', METRICS_TOKEN: 'too-short' })).toThrow(/32 characters/);
  });

  it('requires the exact bearer token when configured', () => {
    const access = service({ NODE_ENV: 'production', METRICS_TOKEN: 'm'.repeat(48) });
    expect(() => access.assertAuthorized()).toThrow(UnauthorizedException);
    expect(() => access.assertAuthorized(`Bearer ${'x'.repeat(48)}`)).toThrow(UnauthorizedException);
    expect(() => access.assertAuthorized(`Bearer ${'m'.repeat(48)}`)).not.toThrow();
  });

  it('keeps local test and development scraping credential-free when no token is configured', () => {
    expect(() => service({ NODE_ENV: 'test' }).assertAuthorized()).not.toThrow();
  });
});
