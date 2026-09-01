import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    const sslSetting = config.get<string>('DATABASE_SSL');
    const automaticSsl = connectionString ? this.shouldUseSsl(connectionString) : false;
    const useSsl = sslSetting === 'true' || (sslSetting !== 'false' && automaticSsl);
    this.pool = connectionString
      ? new Pool({
          connectionString,
          max: 10,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          ssl: useSsl ? { rejectUnauthorized: true } : undefined,
        })
      : null;
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new ServiceUnavailableException('Database connection is not configured');
    }
    return this.pool.query<T>(text, values);
  }

  async ping(): Promise<boolean> {
    if (!this.pool) return false;
    const result = await this.pool.query<{ ok: number }>('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  private shouldUseSsl(connectionString: string): boolean {
    return !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
  }
}
