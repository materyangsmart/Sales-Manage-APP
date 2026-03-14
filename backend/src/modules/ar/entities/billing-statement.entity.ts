import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * BillingStatement - 月结对账单实体（RC4 B2B 账期管理）
 * 每月 1 号由 Cron 任务自动生成上月账单
 */
@Entity('billing_statements')
@Index('idx_billing_customer_id', ['customerId'])
@Index('idx_billing_period', ['billingPeriod'])
@Index('idx_billing_status', ['status'])
@Index('idx_billing_due_date', ['dueDate'])
export class BillingStatement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id', type: 'int', comment: '客户 ID' })
  customerId: number;

  @Column({ name: 'customer_name', type: 'varchar', length: 200, comment: '客户名称（冗余）' })
  customerName: string;

  @Column({ name: 'billing_period', type: 'varchar', length: 7, comment: '账期（格式 YYYY-MM）' })
  billingPeriod: string;

  @Column({ name: 'total_amount', type: 'bigint', default: 0, comment: '账单总金额（分）' })
  totalAmount: number;

  @Column({ name: 'paid_amount', type: 'bigint', default: 0, comment: '已付金额（分）' })
  paidAmount: number;

  @Column({ name: 'outstanding_amount', type: 'bigint', default: 0, comment: '未付金额（分）' })
  outstandingAmount: number;

  @Column({ name: 'order_count', type: 'int', default: 0, comment: '账期内订单数' })
  orderCount: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'],
    default: 'PENDING',
    comment: '账单状态',
  })
  status: string;

  @Column({ name: 'due_date', type: 'date', nullable: true, comment: '到期日' })
  dueDate: string | null;

  @Column({ name: 'notify_sent_at', type: 'datetime', nullable: true, comment: '催款通知发送时间' })
  notifySentAt: Date | null;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
