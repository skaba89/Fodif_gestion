import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class MetricsAccessService {
  private readonly expectedToken?: string;

  constructor(config: ConfigService) {
    const productionRuntime = config.get<string>('NODE_ENV') === 'production';
    const configured = config.get<string>('METRICS_TOKEN')?.trim();
    if (productionRuntime && (!configured || configured.length < 32)) {
      throw new Error('METRICS_TOKEN must contain at least 32 characters when NODE_ENV=production');
    }
    this.expectedToken = configured || undefined;
  }

  assertAuthorized(authorization?: string): void {
    if (!this.expectedToken) return;
    const prefix = 'Bearer ';
    if (!authorization?.startsWith(prefix)) throw new UnauthorizedException('Metrics credentials required');
    const supplied = Buffer.from(authorization.slice(prefix.length), 'utf8');
    const expected = Buffer.from(this.expectedToken, 'utf8');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Invalid metrics credentials');
    }
  }
}
