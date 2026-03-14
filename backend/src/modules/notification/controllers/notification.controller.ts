import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../rbac/guards/jwt-auth.guard';
import { CurrentUser } from '../../rbac/decorators/require-permissions.decorator';
import { JwtPayload } from '../../rbac/decorators/require-permissions.decorator';
import { NotificationService } from '../services/notification.service';

@Controller('api/internal/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /api/internal/notifications/unread-count
   * 获取当前用户的未读消息数量
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.notificationService.getUnreadCount(user.userId);
    return { unreadCount: count };
  }

  /**
   * GET /api/internal/notifications
   * 获取当前用户的通知列表（分页）
   */
  @Get()
  async getNotifications(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.notificationService.getNotificationList(
      user.userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  /**
   * PATCH /api/internal/notifications/:id/read
   * 将指定通知标记为已读
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.notificationService.markAsRead(user.userId, id);
    return { success: true, message: '已标记为已读' };
  }

  /**
   * PATCH /api/internal/notifications/read-all
   * 将所有未读通知标记为已读
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    const count = await this.notificationService.markAllAsRead(user.userId);
    return { success: true, markedCount: count };
  }
}
