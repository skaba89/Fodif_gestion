import { NotFoundException } from '@nestjs/common';
import { NotificationsRepository } from '../src/notifications/notifications.repository';
import { NotificationsService } from '../src/notifications/notifications.service';

describe('NotificationsService', () => {
  it('always scopes reads to the authenticated user', async () => {
    const repository = {
      listOwn: jest.fn().mockResolvedValue({ items: [], unread: 0 }),
    } as unknown as NotificationsRepository;
    const service = new NotificationsService(repository);

    await service.listOwn('user-1', true);

    expect(repository.listOwn).toHaveBeenCalledWith('user-1', true);
  });

  it('does not reveal another user notification', async () => {
    const repository = {
      markRead: jest.fn().mockResolvedValue(null),
    } as unknown as NotificationsRepository;
    const service = new NotificationsService(repository);

    await expect(service.markRead('user-1', 'notification-2')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.markRead).toHaveBeenCalledWith('user-1', 'notification-2');
  });
});

