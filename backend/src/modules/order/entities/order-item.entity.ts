import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
@Index('idx_order_items_order', ['orderId'])
@Index('idx_order_items_product', ['productId'])
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', comment: '订单ID' })
  orderId: number;

  @Column({ name: 'product_id', type: 'int', comment: '产品ID' })
  productId: number;

  @Column({ name: 'product_name', type: 'varchar', length: 200, nullable: true, comment: '产品名称（冗余）' })
  productName: string | null;

  @Column({ name: 'sku', type: 'varchar', length: 50, nullable: true, comment: 'SKU编码（冗余）' })
  sku: string | null;

  @Column({
    name: 'unit_price',
    type: 'int',
    comment: '单价（分）',
  })
  unitPrice: number;

  @Column({ name: 'quantity', type: 'int', comment: '数量' })
  quantity: number;

  @Column({
    name: 'subtotal',
    type: 'int',
    comment: '小计（分）= unit_price * quantity',
  })
  subtotal: number;

  @Column({ name: 'remark', type: 'text', nullable: true, comment: '备注' })
  remark: string | null;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
