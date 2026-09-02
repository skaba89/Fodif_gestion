import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly notifications: NotificationsRepository) {}

  listOwn(userId: string, unreadOnly = false) {
    return this.notifications.listOwn(userId, unreadOnly);
  }

  async markRead(userId: string, id: string) {
    const notification = await this.notifications.markRead(userId, id);
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  markAllRead(userId: string) {
    return this.notifications.markAllRead(userId);
  }
}

