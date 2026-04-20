import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity, NotificationType } from './entities/notification.entity';
import { SocketGateway } from '../common/socket/socket.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    private readonly socketGateway: SocketGateway,
  ) {}

  /**
   * Tạo thông báo mới: Lưu vào DB và bắn Real-time cho người dùng tương ứng.
   */
  async createNotification(data: {
    userId: number;
    type: NotificationType;
    title: string;
    content: string;
    metadata?: Record<string, any>;
  }) {
    const notification = this.notificationRepo.create({
      ...data,
      isRead: false,
    });

    const saved = await this.notificationRepo.save(notification);

    // Phát tín hiệu Real-time tới phòng cá nhân của User
    try {
      this.socketGateway.sendToUser(data.userId, 'notification', saved);
    } catch (error) {
      this.logger.error(
        `Không thể gửi socket notification tới user ${data.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return saved;
  }

  async getMyNotifications(userId: number, page = 1, limit = 20) {
    const [data, total] = await this.notificationRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async markAsRead(userId: number, notificationId: number) {
    await this.notificationRepo.update(
      { id: notificationId, userId },
      { isRead: true },
    );
    return { success: true };
  }

  async markAllAsRead(userId: number) {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
    return { success: true };
  }

  async getUnreadCount(userId: number) {
    const count = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });
    return { count };
  }
}
