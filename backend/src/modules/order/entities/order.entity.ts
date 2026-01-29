import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('orders')
@Index('idx_orders_org', ['orgId'])
@Index('idx_orders_customer', ['customerId'])
@Index('idx_orders_no', ['orderNo'], { unique: true })
@Index('idx_orders_status', ['status'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'org_id', type: 'int', comment: '组织ID' })
  orgId: number;

  @Column({
    name: 'order_no',
    type: 'varchar',
    length: 50,
    unique: true,
    comment: '订单编号',
  })
  orderNo: string;

  @Column({ name: 'customer_id', type: 'int', comment: '客户ID' })
  customerId: number;

  @Column({
    name: 'total_amount',
    type: 'int',
    comment: '订单总金额（分）',
  })
  totalAmount: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'],
    default: 'PENDING_REVIEW',
    comment: '订单状态：PENDING_REVIEW-待审核, APPROVED-已批准, REJECTED-已拒绝, FULFILLED-已完成, CANCELLED-已取消',
  })
  status: string;

  @Column({ name: 'order_date', type: 'date', comment: '订单日期' })
  orderDate: Date;

  @Column({ name: 'delivery_address', type: 'text', nullable: true, comment: '交货地址' })
  deliveryAddress: string | null;

  @Column({ name: 'delivery_date', type: 'date', nullable: true, comment: '交货日期' })
  deliveryDate: Date | null;

  @Column({ name: 'remark', type: 'text', nullable: true, comment: '备注' })
  remark: string | null;

  @Column({ name: 'created_by', type: 'int', comment: '创建人ID' })
  createdBy: number;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true, comment: '审核人ID' })
  reviewedBy: number | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true, comment: '审核时间' })
  reviewedAt: Date | null;

  @Column({ name: 'review_comment', type: 'text', nullable: true, comment: '审核意见' })
  reviewComment: string | null;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];
}
