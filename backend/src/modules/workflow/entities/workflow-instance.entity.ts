import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { WorkflowDefinition } from './workflow-definition.entity';
import { ApprovalLog } from './approval-log.entity';

/**
 * 流程实例状态枚举
 * PENDING:   审批中（等待某个节点的审批人操作）
 * APPROVED:  全部审批通过（所有节点均通过）
 * REJECTED:  被拒绝（某个节点审批人点击了拒绝）
 * CANCELLED: 已撤销（发起人主动撤回）
 * WITHDRAWN: 被驳回（审批人驳回，等待发起人重新提交）
 */
export enum InstanceStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  WITHDRAWN = 'WITHDRAWN',
}

/**
 * 工作流实例表
 * 记录某个具体业务单据（如订单 #12345）正在跑的审批流程
 * 每次发起审批都会创建一条新的实例记录
 */
@Entity('workflow_instances')
@Index('idx_wf_inst_biz', ['businessType', 'businessId'])
@Index('idx_wf_inst_status', ['status'])
@Index('idx_wf_inst_initiator', ['initiatorId'])
export class WorkflowInstance {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  /**
   * 关联的流程定义 ID
   */
  @Column({ name: 'definition_id', type: 'int', unsigned: true, comment: '流程定义 ID' })
  definitionId: number;

  /**
   * 业务类型，如 ORDER, QUALITY, CREDIT
   */
  @Column({ name: 'business_type', type: 'varchar', length: 50, comment: '业务类型' })
  businessType: string;

  /**
   * 业务单据 ID（如订单 ID）
   */
  @Column({ name: 'business_id', type: 'int', unsigned: true, comment: '业务单据 ID' })
  businessId: number;

  /**
   * 业务单据编号（冗余存储，方便查询展示，如订单号 ORD-2024-001）
   */
  @Column({
    name: 'business_no',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '业务单据编号（冗余）',
  })
  businessNo: string | null;

  /**
   * 当前所在步骤序号（对应 WorkflowNode.stepOrder）
   * 0 表示尚未开始，完成后为最后一步的 stepOrder
   */
  @Column({ name: 'current_step', type: 'int', default: 1, comment: '当前审批步骤序号' })
  currentStep: number;

  /**
   * 总步骤数（冗余存储，避免每次查询 nodes）
   */
  @Column({ name: 'total_steps', type: 'int', default: 1, comment: '总步骤数' })
  totalSteps: number;

  /**
   * 实例状态
   */
  @Column({
    name: 'status',
    type: 'enum',
    enum: InstanceStatus,
    default: InstanceStatus.PENDING,
    comment: '实例状态',
  })
  status: InstanceStatus;

  /**
   * 发起人用户 ID
   */
  @Column({ name: 'initiator_id', type: 'int', unsigned: true, comment: '发起人用户 ID' })
  initiatorId: number;

  /**
   * 发起人姓名（冗余存储）
   */
  @Column({
    name: 'initiator_name',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '发起人姓名（冗余）',
  })
  initiatorName: string | null;

  /**
   * 发起人所属部门 ID
   */
  @Column({
    name: 'initiator_org_id',
    type: 'int',
    unsigned: true,
    nullable: true,
    comment: '发起人部门 ID',
  })
  initiatorOrgId: number | null;

  /**
   * 申请说明（发起时填写的备注）
   */
  @Column({
    name: 'apply_reason',
    type: 'text',
    nullable: true,
    comment: '申请说明',
  })
  applyReason: string | null;

  /**
   * 最终完结时间（APPROVED/REJECTED/CANCELLED 时记录）
   */
  @Column({ name: 'finished_at', type: 'datetime', nullable: true, comment: '流程完结时间' })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联流程定义
  @ManyToOne(() => WorkflowDefinition, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'definition_id' })
  definition: WorkflowDefinition;

  // 关联审批日志
  @OneToMany(() => ApprovalLog, (log) => log.instance, { cascade: true })
  logs: ApprovalLog[];
}
