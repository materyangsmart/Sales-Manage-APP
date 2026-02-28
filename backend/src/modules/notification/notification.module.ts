import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageTemplate } from './entities/message-template.entity';
import { Notification } from './entities/notification.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationService } from './services/notification.service';
import { NotificationController } from './controllers/notification.controller';

/**
 * 实时消息与预警触达中心模块
 *
 * 功能：
 * 1. 监听 workflow.node.pending 事件，自动为审批人生成站内待办通知
 * 2. 提供未读数查询、通知列表、标记已读 API
 * 3. 预留外部 Webhook 扩展点（通过 NotificationService.createSystemNotification）
 *
 * 依赖：
 * - @nestjs/event-emitter（在 AppModule 中全局注册）
 * - RBAC 模块的 user_roles 表（通过 EntityManager 直接查询）
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MessageTemplate, Notification, UserNotification]),
  ],
  providers: [NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService], // 导出供其他模块（如 CeoRadar）调用
})
export class NotificationModule {}
