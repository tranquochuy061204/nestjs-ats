import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { ApiAuth } from '../common/decorators/api-auth.decorator';

interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    role: string;
  };
}

@ApiTags('Notifications')
@Controller('notifications')
@ApiAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(
    @Req() req: RequestWithUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.notificationsService.getMyNotifications(
      req.user.id,
      page,
      limit,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: RequestWithUser) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch('mark-all-read')
  async markAllAsRead(@Req() req: RequestWithUser) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  async markAsRead(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }
}
