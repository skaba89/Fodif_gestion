import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { DatabaseService } from '../database/database.service';
import { DocumentStorageService } from '../documents/document-storage.service';

interface DependencyChecks {
  database: 'up' | 'down';
  objectStorage: 'up' | 'down';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly documentStorage: DocumentStorageService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Backward-compatible liveness endpoint' })
  health() {
    return this.live();
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Process liveness endpoint' })
  live() {
    return {
      status: 'ok',
      service: 'fodip-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Dependency-aware readiness endpoint' })
  @ApiResponse({ status: 503, description: 'Database or object storage is unavailable' })
  async ready() {
    const [databaseUp, objectStorageUp] = await Promise.all([
      this.database.ping().catch(() => false),
      this.documentStorage.ping().catch(() => false),
    ]);
    const checks: DependencyChecks = {
      database: databaseUp ? 'up' : 'down',
      objectStorage: objectStorageUp ? 'up' : 'down',
    };
    const response = {
      status: databaseUp && objectStorageUp ? 'ready' : 'unavailable',
      service: 'fodip-api',
      checks,
      timestamp: new Date().toISOString(),
    };

    if (!databaseUp || !objectStorageUp) {
      throw new ServiceUnavailableException(response);
    }
    return response;
  }
}
