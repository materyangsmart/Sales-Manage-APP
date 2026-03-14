import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageTemplate } from './entities/message-template.entity';
import { Notification } from './entities/notification.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationService } from './services/notification.service';
import { NotificationController } from './controllers/notification.controller';
import { NotificationGateway } from './gateways/notification.gateway';
import { SocketUserMapService } from './services/socket-user-map.service';

/**
 * 实时消息与预警触达中心模块
 *
 * 功能：
 * 1. 监听 workflow.node.pending 事件，自动为审批人生成站内待办通知
 * 2. WebSocket 实时推送（NotificationGateway + JWT 握手鉴权 + SocketUserMapService）
 * 3. 提供未读数查询、通知列表、标记已读 API
 * 4. 全局审计日志看板 API（通过 ar 模块）
 *
 * 依赖：
 * - @nestjs/event-emitter（在 AppModule 中全局注册）
 * - @nestjs/websockets + socket.io（WebSocket 支持）
 * - RBAC 模块的 user_roles 表（通过 EntityManager 直接查询）
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MessageTemplate, Notification, UserNotification]),
  ],
  providers: [
    NotificationService,
    NotificationGateway,
    SocketUserMapService,
  ],
  controllers: [NotificationController],
  exports: [NotificationService, NotificationGateway], // 导出供其他模块调用
})
export class NotificationModule {}
