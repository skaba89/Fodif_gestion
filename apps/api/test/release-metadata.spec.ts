import { ConfigService } from '@nestjs/config';
import { releaseMetadata } from '../src/release-metadata';

function metadata(values: Record<string, string | undefined>) {
  return releaseMetadata({ get: (key: string) => values[key] } as ConfigService);
}

describe('releaseMetadata', () => {
  it('prefers the explicit institutional release SHA', () => {
    expect(metadata({ APP_ENV: ' prod ', FODIP_RELEASE_SHA: 'release-1', RENDER_GIT_COMMIT: 'render-1' }))
      .toEqual({ environment: 'PROD', releaseSha: 'release-1' });
  });

  it('uses provider metadata and safe unknown fallbacks', () => {
    expect(metadata({ APP_ENV: 'QUALIFICATION', RENDER_GIT_COMMIT: 'render-1' }))
      .toEqual({ environment: 'QUALIFICATION', releaseSha: 'render-1' });
    expect(metadata({})).toEqual({ environment: 'UNKNOWN', releaseSha: 'unknown' });
  });
});
