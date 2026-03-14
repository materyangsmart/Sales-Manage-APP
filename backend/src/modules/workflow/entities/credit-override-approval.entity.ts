import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * CreditOverrideApproval - 信用超限特批工作流实体（RC4 B2B 信用额度控制）
 * 当客户订单金额超出信用额度时，自动触发财务总监特批流程
 */
@Entity('credit_override_approvals')
@Index('idx_credit_override_customer_id', ['customerId'])
@Index('idx_credit_override_status', ['status'])
@Index('idx_credit_override_order_id', ['orderId'])
@Index('idx_credit_override_created_at', ['createdAt'])
export class CreditOverrideApproval {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id', type: 'int', comment: '客户 ID' })
  customerId: number;

  @Column({ name: 'customer_name', type: 'varchar', length: 200, comment: '客户名称（冗余）' })
  customerName: string;

  @Column({ name: 'order_id', type: 'int', nullable: true, comment: '关联订单 ID' })
  orderId: number | null;

  @Column({ name: 'order_amount', type: 'bigint', comment: '订单金额（分）' })
  orderAmount: number;

  @Column({ name: 'credit_limit', type: 'bigint', comment: '信用额度（分）' })
  creditLimit: number;

  @Column({ name: 'used_credit', type: 'bigint', comment: '已用额度（分）' })
  usedCredit: number;

  @Column({ name: 'exceeded_amount', type: 'bigint', comment: '超出金额（分）' })
  exceededAmount: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'],
    default: 'PENDING',
    comment: '特批状态',
  })
  status: string;

  @Column({ name: 'approver_id', type: 'int', nullable: true, comment: '审批人 ID（财务总监）' })
  approverId: number | null;

  @Column({ name: 'approver_name', type: 'varchar', length: 100, nullable: true, comment: '审批人姓名' })
  approverName: string | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true, comment: '审批时间' })
  approvedAt: Date | null;

  @Column({ name: 'approval_note', type: 'text', nullable: true, comment: '审批备注' })
  approvalNote: string | null;

  @Column({ name: 'requested_by', type: 'int', comment: '申请人 ID（销售员）' })
  requestedBy: number;

  @Column({ name: 'requested_by_name', type: 'varchar', length: 100, comment: '申请人姓名' })
  requestedByName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
