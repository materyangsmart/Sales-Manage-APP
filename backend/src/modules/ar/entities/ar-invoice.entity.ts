import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('ar_invoices')
@Index(['orgId', 'customerId'])
@Index(['orgId', 'status'])
@Index(['orgId', 'dueDate'])
export class ARInvoice {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'org_id', type: 'int', comment: '组织ID (2=SalesCo)' })
  @Index()
  orgId: number;

  @Column({ name: 'customer_id', type: 'bigint', comment: '客户ID' })
  @Index()
  customerId: number;

  @Column({
    name: 'invoice_no',
    type: 'varchar',
    length: 50,
    unique: true,
    comment: '应收单号',
  })
  invoiceNo: string;

  @Column({
    name: 'order_id',
    type: 'bigint',
    nullable: true,
    comment: '关联订单ID',
  })
  orderId: number | null;

  @Column({ name: 'amount', type: 'bigint', comment: '应收金额(分)' })
  amount: number;

  @Column({ name: 'tax_amount', type: 'bigint', comment: '税额(分)' })
  taxAmount: number;

  @Column({ name: 'balance', type: 'bigint', comment: '余额(分)' })
  balance: number;

  @Column({ name: 'due_date', type: 'date', comment: '到期日' })
  dueDate: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['OPEN', 'PARTIAL', 'CLOSED', 'WRITTEN_OFF'],
    default: 'OPEN',
    comment:
      '状态: OPEN=未收款, PARTIAL=部分收款, CLOSED=已结清, WRITTEN_OFF=已核销',
  })
  status: string;

  @Column({ name: 'remark', type: 'text', nullable: true, comment: '备注' })
  remark: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    comment: '创建时间',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    comment: '更新时间',
  })
  updatedAt: Date;

  @VersionColumn({
    name: 'version',
    type: 'int',
    default: 0,
    comment: '乐观锁版本号',
  })
  version: number;
}
