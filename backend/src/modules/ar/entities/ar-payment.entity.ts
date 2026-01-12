import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('ar_payments')
@Index(['orgId', 'customerId'])
@Index(['orgId', 'paymentDate'])
export class ARPayment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'org_id', type: 'int', comment: '组织ID (2=SalesCo)' })
  @Index()
  orgId: number;

  @Column({ name: 'customer_id', type: 'bigint', comment: '客户ID' })
  @Index()
  customerId: number;

  @Column({
    name: 'payment_no',
    type: 'varchar',
    length: 50,
    unique: true,
    comment: '收款单号',
  })
  paymentNo: string;

  @Column({
    name: 'bank_ref',
    type: 'varchar',
    length: 100,
    unique: true,
    comment: '银行流水号',
  })
  bankRef: string;

  @Column({ name: 'amount', type: 'bigint', comment: '收款金额(分)' })
  amount: number;

  @Column({
    name: 'unapplied_amount',
    type: 'bigint',
    comment: '未核销金额(分)',
  })
  unappliedAmount: number;

  @Column({ name: 'payment_date', type: 'date', comment: '收款日期' })
  paymentDate: Date;

  @Column({
    name: 'payment_method',
    type: 'varchar',
    length: 50,
    comment: '收款方式',
  })
  paymentMethod: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['UNAPPLIED', 'PARTIAL', 'APPLIED'],
    default: 'UNAPPLIED',
    comment: '状态: UNAPPLIED=未核销, PARTIAL=部分核销, APPLIED=已核销',
  })
  status: string;

  @Column({
    name: 'receipt_url',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '回单URL',
  })
  receiptUrl: string | null;

  @Column({ name: 'remark', type: 'text', nullable: true, comment: '备注' })
  remark: string | null;

  @Column({ name: 'created_by', type: 'bigint', comment: '创建人ID' })
  createdBy: number;

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
