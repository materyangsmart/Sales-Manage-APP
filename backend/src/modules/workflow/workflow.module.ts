import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowNode } from './entities/workflow-node.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { ApprovalLog } from './entities/approval-log.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { WorkflowService } from './services/workflow.service';
import { WorkflowController } from './controllers/workflow.controller';
import { RedisModule } from '../infra/redis.module';

/**
 * 工作流模块
 * 依赖 RBAC 模块的 UserRole Entity 进行权限校验
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      WorkflowNode,
      WorkflowInstance,
      ApprovalLog,
      UserRole, // 引入 RBAC 的 UserRole 用于权限校验
    ]),
    RedisModule, // 引入 Redis 模块，提供分布式锁
  ],
  providers: [WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService], // 导出供 OrderModule 等使用
})
export class WorkflowModule {}
