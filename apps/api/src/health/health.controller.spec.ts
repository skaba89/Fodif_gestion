import { ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { DocumentStorageService } from '../documents/document-storage.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const database = { ping: jest.fn() };
  const documentStorage = { ping: jest.fn() };
  const controller = new HealthController(
    database as unknown as DatabaseService,
    documentStorage as unknown as DocumentStorageService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('reports ready only when every critical dependency is reachable', async () => {
    database.ping.mockResolvedValue(true);
    documentStorage.ping.mockResolvedValue(true);

    await expect(controller.ready()).resolves.toMatchObject({
      status: 'ready',
      checks: { database: 'up', objectStorage: 'up' },
    });
  });

  it('returns a safe 503 response when a dependency fails', async () => {
    database.ping.mockRejectedValue(new Error('postgresql://secret@internal-host'));
    documentStorage.ping.mockResolvedValue(true);

    await expect(controller.ready()).rejects.toEqual(expect.any(ServiceUnavailableException));
    try {
      await controller.ready();
    } catch (error) {
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
        status: 'unavailable',
        checks: { database: 'down', objectStorage: 'up' },
      });
      expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain('secret');
    }
  });
});
