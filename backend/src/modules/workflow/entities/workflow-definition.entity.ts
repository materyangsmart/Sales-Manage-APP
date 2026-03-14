import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { WorkflowNode } from './workflow-node.entity';

/**
 * 工作流定义表
 * 定义流程模板，如"超低折扣订单审批"、"质量问题处理"等
 * 一个 code 对应一套完整的审批节点链
 */
@Entity('workflow_definitions')
@Index('idx_wf_def_code', ['code'], { unique: true })
export class WorkflowDefinition {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  /**
   * 流程编码（唯一标识），如 ORDER_DISCOUNT, QUALITY_ISSUE, CREDIT_RELEASE
   */
  @Column({ name: 'code', type: 'varchar', length: 100, comment: '流程编码，全局唯一' })
  code: string;

  /**
   * 流程名称，如"超低折扣订单审批"
   */
  @Column({ name: 'name', type: 'varchar', length: 200, comment: '流程名称' })
  name: string;

  /**
   * 流程描述
   */
  @Column({ name: 'description', type: 'text', nullable: true, comment: '流程描述' })
  description: string | null;

  /**
   * 适用的业务类型，如 ORDER, QUALITY, CREDIT
   */
  @Column({ name: 'business_type', type: 'varchar', length: 50, comment: '适用业务类型' })
  businessType: string;

  /**
   * 流程状态：ACTIVE 启用 / INACTIVE 停用
   */
  @Column({
    name: 'status',
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
    comment: '流程状态',
  })
  status: 'ACTIVE' | 'INACTIVE';

  /**
   * 触发条件描述（JSON 格式，如 {"discount_rate": {"lt": 0.85}}）
   * 供业务层判断是否需要触发此流程
   */
  @Column({
    name: 'trigger_condition',
    type: 'text',
    nullable: true,
    comment: '触发条件（JSON）',
  })
  triggerCondition: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联的审批节点
  @OneToMany(() => WorkflowNode, (node) => node.definition, { cascade: true })
  nodes: WorkflowNode[];
}
