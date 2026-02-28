import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageTemplate } from '../entities/message-template.entity';
import { Notification } from '../entities/notification.entity';
import { UserNotification } from '../entities/user-notification.entity';
import {
  WorkflowPendingEvent,
  WORKFLOW_EVENTS,
} from '../events/workflow-pending.event';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(MessageTemplate)
    private readonly templateRepo: Repository<MessageTemplate>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(UserNotification)
    private readonly userNotificationRepo: Repository<UserNotification>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // 事件监听器：workflow.node.pending
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 监听工作流节点待审批事件
   * 自动为对应角色的所有用户生成站内待办通知
   */
  @OnEvent(WORKFLOW_EVENTS.NODE_PENDING, { async: true })
  async handleWorkflowPendingEvent(event: WorkflowPendingEvent): Promise<void> {
    this.logger.log(
      `[事件监听器] 接收到 workflow.node.pending 事件: instanceId=${event.instanceId}, roleId=${event.roleId}`,
    );

    try {
      // 1. 查找消息模板
      const template = await this.templateRepo.findOne({
        where: { code: 'WORKFLOW_PENDING', isActive: true },
      });

      const titleTemplate =
        template?.titleTemplate ??
        '【待审批】{{workflowName}} 需要您的审批';
      const contentTemplate =
        template?.contentTemplate ??
        '{{submittedByName}} 于 {{submittedAt}} 提交了 {{businessType}} #{{businessId}} 的审批申请，请您及时处理。';

      // 2. 渲染模板变量
      const vars: Record<string, string> = {
        workflowName: event.workflowName,
        businessType: event.businessType,
        businessId: String(event.businessId),
        submittedByName: event.submittedByName,
        submittedAt: event.submittedAt.toLocaleString('zh-CN'),
        instanceId: String(event.instanceId),
        currentStep: String(event.currentStep),
      };

      const title = this.renderTemplate(titleTemplate, vars);
      const content = this.renderTemplate(contentTemplate, vars);

      // 3. 创建通知主体
      const notification = await this.notificationRepo.save(
        this.notificationRepo.create({
          type: 'APPROVAL',
          title,
          content,
          businessType: event.businessType,
          businessId: event.businessId,
          sourceRef: `workflow_instance:${event.instanceId}`,
          metadata: {
            instanceId: event.instanceId,
            workflowCode: event.workflowCode,
            roleId: event.roleId,
            submittedByUserId: event.submittedByUserId,
          },
        }),
      );

      this.logger.log(
        `[NotificationService] 通知主体创建成功: notificationId=${notification.id}`,
      );

      // 4. 结合 RBAC 查出该角色对应的所有用户 ID
      const userIds = await this.getUserIdsByRoleId(event.roleId);

      this.logger.log(
        `[NotificationService] 结合 RBAC 查出角色 ${event.roleId} 对应的 ${userIds.length} 个用户: [${userIds.join(', ')}]`,
      );

      if (userIds.length === 0) {
        this.logger.warn(
          `[NotificationService] 角色 ${event.roleId} 没有对应的用户，跳过通知`,
        );
        return;
      }

      // 5. 批量插入 UserNotification（站内待办通知）
      const userNotifications = userIds.map((userId) =>
        this.userNotificationRepo.create({
          userId,
          notificationId: notification.id,
          isRead: false,
          readAt: null,
          priority: 'HIGH',
        }),
      );

      await this.userNotificationRepo.save(userNotifications);

      this.logger.log(
        `[NotificationService] ✅ 成功为 ${userIds.length} 个用户生成未读通知 (notificationId=${notification.id})`,
      );
    } catch (error) {
      this.logger.error(
        `[NotificationService] 处理 workflow.node.pending 事件失败: ${error.message}`,
        error.stack,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 核心业务方法
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 根据角色 ID 查询所有拥有该角色的用户 ID
   * 通过 user_roles 关联表查询
   */
  async getUserIdsByRoleId(roleId: number): Promise<number[]> {
    const result = await this.userNotificationRepo.manager.query(
      `SELECT DISTINCT ur.user_id FROM user_roles ur WHERE ur.role_id = ?`,
      [roleId],
    );
    return result.map((row: { user_id: number }) => row.user_id);
  }

  /**
   * 获取用户未读消息数量
   */
  async getUnreadCount(userId: number): Promise<number> {
    return this.userNotificationRepo.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * 获取用户通知列表（分页）
   */
  async getNotificationList(
    userId: number,
    page = 1,
    pageSize = 20,
  ): Promise<{
    items: Array<{
      id: number;
      notificationId: number;
      isRead: boolean;
      readAt: Date | null;
      priority: string;
      createdAt: Date;
      notification: {
        type: string;
        title: string;
        content: string;
        businessType: string | null;
        businessId: number | null;
        createdAt: Date;
      };
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const [items, total] = await this.userNotificationRepo.findAndCount({
      where: { userId },
      relations: ['notification'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((un) => ({
        id: un.id,
        notificationId: un.notificationId,
        isRead: un.isRead,
        readAt: un.readAt,
        priority: un.priority,
        createdAt: un.createdAt,
        notification: {
          type: un.notification.type,
          title: un.notification.title,
          content: un.notification.content,
          businessType: un.notification.businessType,
          businessId: un.notification.businessId,
          createdAt: un.notification.createdAt,
        },
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 将指定通知标记为已读
   */
  async markAsRead(userId: number, userNotificationId: number): Promise<void> {
    const un = await this.userNotificationRepo.findOne({
      where: { id: userNotificationId, userId },
    });

    if (!un) {
      throw new Error(`通知 ${userNotificationId} 不存在或无权限`);
    }

    if (un.isRead) {
      return; // 已经是已读状态，幂等处理
    }

    await this.userNotificationRepo.update(
      { id: userNotificationId, userId },
      { isRead: true, readAt: new Date() },
    );

    this.logger.log(
      `[NotificationService] 用户 ${userId} 已读通知 ${userNotificationId}`,
    );
  }

  /**
   * 批量标记所有通知为已读
   */
  async markAllAsRead(userId: number): Promise<number> {
    const result = await this.userNotificationRepo.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /**
   * 手动创建系统通知（用于预警、公告等）
   */
  async createSystemNotification(params: {
    type: 'SYSTEM' | 'APPROVAL' | 'ALERT';
    title: string;
    content: string;
    businessType?: string;
    businessId?: number;
    targetUserIds: number[];
    priority?: 'HIGH' | 'NORMAL' | 'LOW';
  }): Promise<Notification> {
    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({
        type: params.type,
        title: params.title,
        content: params.content,
        businessType: params.businessType ?? null,
        businessId: params.businessId ?? null,
        sourceRef: null,
        metadata: null,
      }),
    );

    if (params.targetUserIds.length > 0) {
      const userNotifications = params.targetUserIds.map((userId) =>
        this.userNotificationRepo.create({
          userId,
          notificationId: notification.id,
          isRead: false,
          readAt: null,
          priority: params.priority ?? 'NORMAL',
        }),
      );
      await this.userNotificationRepo.save(userNotifications);
    }

    return notification;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 工具方法
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 渲染模板变量（将 {{variable}} 替换为实际值）
   */
  private renderTemplate(
    template: string,
    vars: Record<string, string>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
  }
}
