import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WorkflowInstance } from './workflow-instance.entity';

/**
 * 审批动作枚举
 * APPROVE:   同意（流程向下一步流转）
 * REJECT:    拒绝（流程终止，实例状态变为 REJECTED）
 * WITHDRAW:  驳回（退回给发起人，实例状态变为 WITHDRAWN）
 * CANCEL:    撤销（发起人主动撤回，实例状态变为 CANCELLED）
 * SUBMIT:    提交（发起人发起或重新提交）
 * CC:        抄送（系统自动记录，无需操作）
 */
export enum ApprovalAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  WITHDRAW = 'WITHDRAW',
  CANCEL = 'CANCEL',
  SUBMIT = 'SUBMIT',
  CC = 'CC',
}

/**
 * 审批流转日志表
 * 记录每一次审批动作的完整信息，是不可篡改的审计链
 * 每次流转都会插入一条新记录，不更新旧记录
 */
@Entity('approval_logs')
@Index('idx_approval_log_instance', ['instanceId'])
@Index('idx_approval_log_operator', ['operatorId'])
@Index('idx_approval_log_step', ['instanceId', 'stepOrder'])
export class ApprovalLog {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  /**
   * 关联的流程实例 ID
   */
  @Column({ name: 'instance_id', type: 'int', unsigned: true, comment: '流程实例 ID' })
  instanceId: number;

  /**
   * 当前步骤序号（记录此动作发生在第几步）
   */
  @Column({ name: 'step_order', type: 'int', comment: '审批步骤序号' })
  stepOrder: number;

  /**
   * 节点名称（冗余存储，方便展示）
   */
  @Column({
    name: 'node_name',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '节点名称（冗余）',
  })
  nodeName: string | null;

  /**
   * 操作人用户 ID
   */
  @Column({ name: 'operator_id', type: 'int', unsigned: true, comment: '操作人用户 ID' })
  operatorId: number;

  /**
   * 操作人姓名（冗余存储）
   */
  @Column({
    name: 'operator_name',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '操作人姓名（冗余）',
  })
  operatorName: string | null;

  /**
   * 操作人角色编码（冗余存储，记录审批时的角色身份）
   */
  @Column({
    name: 'operator_role',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '操作人角色编码（冗余）',
  })
  operatorRole: string | null;

  /**
   * 审批动作
   */
  @Column({
    name: 'action',
    type: 'enum',
    enum: ApprovalAction,
    comment: '审批动作',
  })
  action: ApprovalAction;

  /**
   * 审批意见（同意/拒绝时填写的文字说明）
   */
  @Column({
    name: 'comment',
    type: 'text',
    nullable: true,
    comment: '审批意见',
  })
  comment: string | null;

  /**
   * 流转前的实例状态（用于回溯）
   */
  @Column({
    name: 'from_status',
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '流转前状态',
  })
  fromStatus: string | null;

  /**
   * 流转后的实例状态
   */
  @Column({
    name: 'to_status',
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '流转后状态',
  })
  toStatus: string | null;

  /**
   * 操作时间（不可更新，只有 CreatedAt）
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 关联流程实例
  @ManyToOne(() => WorkflowInstance, (inst) => inst.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instance_id' })
  instance: WorkflowInstance;
}
