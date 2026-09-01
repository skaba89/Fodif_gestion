import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentStorageService } from '../src/documents/document-storage.service';

describe('DocumentStorageService configuration', () => {
  it('fails closed when S3-compatible storage is not configured', async () => {
    const service = new DocumentStorageService(new ConfigService({}));
    await expect(service.upload('private/key', Buffer.from('file'), 'application/pdf', 'checksum'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
