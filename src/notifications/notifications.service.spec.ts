import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationEntity, NotificationType } from './entities/notification.entity';
import { SocketGateway } from '../common/socket/socket.gateway';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: any;
  let gateway: any;

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  const mockGateway = {
    sendToUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: mockRepo,
        },
        {
          provide: SocketGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repo = module.get(getRepositoryToken(NotificationEntity));
    gateway = module.get<SocketGateway>(SocketGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNotification', () => {
    it('should save notification and emit socket event', async () => {
      const data = {
        userId: 1,
        type: NotificationType.APPLICATION_STATUS,
        title: 'Title',
        content: 'Content',
      };
      const savedNotification = { ...data, id: 100, isRead: false };
      
      repo.create.mockReturnValue(savedNotification);
      repo.save.mockResolvedValue(savedNotification);

      const result = await service.createNotification(data);

      expect(repo.create).toHaveBeenCalledWith({ ...data, isRead: false });
      expect(repo.save).toHaveBeenCalledWith(savedNotification);
      expect(gateway.sendToUser).toHaveBeenCalledWith(1, 'notification', savedNotification);
      expect(result).toEqual(savedNotification);
    });

    it('should not throw if socket emission fails', async () => {
      const data = { userId: 1, type: NotificationType.SYSTEM, title: 'T', content: 'C' };
      repo.create.mockReturnValue(data);
      repo.save.mockResolvedValue(data);
      gateway.sendToUser.mockImplementation(() => {
        throw new Error('Socket failed');
      });

      await expect(service.createNotification(data)).resolves.not.toThrow();
    });
  });

  describe('getMyNotifications', () => {
    it('should return paginated notifications', async () => {
      const notifications = [{ id: 1 }, { id: 2 }];
      repo.findAndCount.mockResolvedValue([notifications, 2]);

      const result = await service.getMyNotifications(1, 1, 10);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result.data).toEqual(notifications);
      expect(result.total).toBe(2);
      expect(result.lastPage).toBe(1);
    });
  });

  describe('Unread Logic', () => {
    it('should mark as read', async () => {
      await service.markAsRead(1, 100);
      expect(repo.update).toHaveBeenCalledWith({ id: 100, userId: 1 }, { isRead: true });
    });

    it('should get unread count', async () => {
      repo.count.mockResolvedValue(5);
      const result = await service.getUnreadCount(1);
      expect(result.count).toBe(5);
    });
  });
});
