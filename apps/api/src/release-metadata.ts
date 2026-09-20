import { ConfigService } from '@nestjs/config';

export function releaseMetadata(config: ConfigService) {
  return {
    environment: config.get<string>('APP_ENV')?.trim().toUpperCase() || 'UNKNOWN',
    releaseSha: config.get<string>('FODIP_RELEASE_SHA')
      || config.get<string>('RENDER_GIT_COMMIT')
      || config.get<string>('GITHUB_SHA')
      || 'unknown',
  };
}
