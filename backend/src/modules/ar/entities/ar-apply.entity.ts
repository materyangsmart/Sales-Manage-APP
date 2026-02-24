import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('ar_apply')
@Index(['orgId', 'paymentId'])
@Index(['orgId', 'invoiceId'])
@Index(['paymentId', 'invoiceId'], { unique: true })
export class ARApply {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'org_id', type: 'int', comment: '组织ID (2=SalesCo)' })
  @Index()
  orgId: number;

  @Column({ name: 'payment_id', type: 'bigint', comment: '收款单ID' })
  paymentId: number;

  @Column({ name: 'invoice_id', type: 'bigint', comment: '应收单ID' })
  invoiceId: number;

  @Column({ name: 'applied_amount', type: 'bigint', comment: '核销金额(分)' })
  appliedAmount: number;

  @Column({ name: 'operator_id', type: 'bigint', comment: '操作人ID' })
  operatorId: number;

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
