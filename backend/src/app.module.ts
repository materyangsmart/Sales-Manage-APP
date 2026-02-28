import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ARModule } from './modules/ar/ar.module';
import { OrderModule } from './modules/order/order.module';
import { HealthModule } from './modules/health/health.module';
import { CustomerModule } from './modules/customer/customer.module';
import { UserModule } from './modules/user/user.module';
import { CommissionModule } from './modules/commission/commission.module';
import { TraceabilityModule } from './modules/traceability/traceability.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { CeoRadarModule } from './modules/ceo-radar/ceo-radar.module';
import { ExportModule } from './modules/export/export.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { RedisModule } from './modules/infra/redis.module';
import { NotificationModule } from './modules/notification/notification.module';

// Explicitly import all entities to ensure TypeORM loads them correctly
import { ARApply } from './modules/ar/entities/ar-apply.entity';
import { ARInvoice } from './modules/ar/entities/ar-invoice.entity';
import { ARPayment } from './modules/ar/entities/ar-payment.entity';
import { AuditLog } from './modules/ar/entities/audit-log.entity';
import { Customer as CustomerEntity } from './modules/customer/entities/customer.entity';
import { QualityFeedback } from './modules/feedback/entities/quality-feedback.entity';
import { Customer as OrderCustomerEntity } from './modules/order/entities/customer.entity';
import { OrderItem } from './modules/order/entities/order-item.entity';
import { Order } from './modules/order/entities/order.entity';
import { Product } from './modules/order/entities/product.entity';
import { DeliveryRecord } from './modules/traceability/entities/delivery-record.entity';
import { ProductionPlan } from './modules/traceability/entities/production-plan.entity';
import { User } from './modules/user/entities/user.entity';
// RBAC Entities
import { Organization } from './modules/rbac/entities/organization.entity';
import { Role } from './modules/rbac/entities/role.entity';
import { Permission } from './modules/rbac/entities/permission.entity';
import { RolePermission } from './modules/rbac/entities/role-permission.entity';
import { UserRole } from './modules/rbac/entities/user-role.entity';
// Workflow Entities
import { WorkflowDefinition } from './modules/workflow/entities/workflow-definition.entity';
import { WorkflowNode } from './modules/workflow/entities/workflow-node.entity';
import { WorkflowInstance } from './modules/workflow/entities/workflow-instance.entity';
import { ApprovalLog } from './modules/workflow/entities/approval-log.entity';
// Export Entities
import { ExportTask } from './modules/export/entities/export-task.entity';
// Notification Entities（3 个新增）
import { MessageTemplate } from './modules/notification/entities/message-template.entity';
import { Notification } from './modules/notification/entities/notification.entity';
import { UserNotification } from './modules/notification/entities/user-notification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ─── 事件驱动基础设施（全局注册，供所有模块使用）─────────────────────
    EventEmitterModule.forRoot({
      // 使用通配符支持 'workflow.*' 等模式监听
      wildcard: false,
      // 最大监听器数量（防止内存泄漏警告）
      maxListeners: 20,
      // 异步事件处理（不阻塞主线程）
      verboseMemoryLeak: true,
    }),

    // ─── Redis 基础设施（全局缓存 + BullMQ + 分布式锁）─────────────────────
    RedisModule,

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'qianzhang_sales'),
        // Explicitly list all entities instead of using glob pattern
        entities: [
          // 原有业务实体（13 个）
          ARApply,
          ARInvoice,
          ARPayment,
          AuditLog,
          CustomerEntity,
          QualityFeedback,
          OrderCustomerEntity,
          OrderItem,
          Order,
          Product,
          DeliveryRecord,
          ProductionPlan,
          User,
          // RBAC 实体（5 个）
          Organization,
          Role,
          Permission,
          RolePermission,
          UserRole,
          // Workflow 实体（4 个）
          WorkflowDefinition,
          WorkflowNode,
          WorkflowInstance,
          ApprovalLog,
          // Export 实体（1 个）
          ExportTask,
          // Notification 实体（3 个新增，总计 26 个实体）
          MessageTemplate,
          Notification,
          UserNotification,
        ],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: configService.get('DB_SYNC', 'false') === 'true',
        logging: configService.get('DB_LOGGING', 'false') === 'true',
      }),
      inject: [ConfigService],
    }),
    ARModule,
    OrderModule,
    HealthModule,
    CustomerModule,
    UserModule,
    CommissionModule,
    TraceabilityModule,
    FeedbackModule,
    CeoRadarModule,
    ExportModule,
    RbacModule,
    WorkflowModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
