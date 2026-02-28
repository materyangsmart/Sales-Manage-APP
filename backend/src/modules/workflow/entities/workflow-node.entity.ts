import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WorkflowDefinition } from './workflow-definition.entity';

/**
 * 节点类型枚举
 * APPROVAL: 需要审批人点击同意/拒绝
 * CC: 抄送（自动流转，只记录，不需要操作）
 * NOTIFY: 通知（触发外部通知，不阻塞流程）
 */
export enum NodeType {
  APPROVAL = 'APPROVAL',
  CC = 'CC',
  NOTIFY = 'NOTIFY',
}

/**
 * 工作流节点表
 * 定义流程中每个审批步骤的顺序、类型和负责角色
 * step_order 决定流转顺序，从 1 开始递增
 */
@Entity('workflow_nodes')
@Index('idx_wf_node_def_step', ['definitionId', 'stepOrder'])
export class WorkflowNode {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  /**
   * 关联的流程定义 ID
   */
  @Column({ name: 'definition_id', type: 'int', unsigned: true, comment: '流程定义 ID' })
  definitionId: number;

  /**
   * 步骤序号（从 1 开始，决定审批顺序）
   */
  @Column({ name: 'step_order', type: 'int', unsigned: true, comment: '步骤序号，从1开始' })
  stepOrder: number;

  /**
   * 节点名称，如"大区总监审批"、"财务总监审批"
   */
  @Column({ name: 'node_name', type: 'varchar', length: 100, comment: '节点名称' })
  nodeName: string;

  /**
   * 节点类型：APPROVAL（审批）/ CC（抄送）/ NOTIFY（通知）
   */
  @Column({
    name: 'node_type',
    type: 'enum',
    enum: NodeType,
    default: NodeType.APPROVAL,
    comment: '节点类型',
  })
  nodeType: NodeType;

  /**
   * 需要哪个角色来审批（关联 RBAC 的 roles 表）
   * CC 节点也可以指定角色（抄送给该角色的用户）
   */
  @Column({
    name: 'role_id',
    type: 'int',
    unsigned: true,
    nullable: true,
    comment: '审批角色 ID（关联 RBAC roles 表）',
  })
  roleId: number | null;

  /**
   * 是否允许拒绝后重新提交（true=驳回到发起人，false=直接终止）
   */
  @Column({
    name: 'allow_resubmit',
    type: 'tinyint',
    width: 1,
    default: 1,
    comment: '是否允许驳回后重新提交',
  })
  allowResubmit: boolean;

  /**
   * 超时时间（小时），超时后自动同意（0=不超时）
   */
  @Column({
    name: 'timeout_hours',
    type: 'int',
    default: 0,
    comment: '超时自动同意小时数（0=不超时）',
  })
  timeoutHours: number;

  /**
   * 节点备注
   */
  @Column({ name: 'remark', type: 'varchar', length: 500, nullable: true, comment: '节点备注' })
  remark: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联流程定义
  @ManyToOne(() => WorkflowDefinition, (def) => def.nodes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'definition_id' })
  definition: WorkflowDefinition;
}
