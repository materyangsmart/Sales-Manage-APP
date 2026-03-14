import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * InventoryLog - 出入库流水实体（RC4 WMS）
 */
@Entity('inventory_log')
@Index('idx_inventory_log_inventory_id', ['inventoryId'])
@Index('idx_inventory_log_type', ['type'])
@Index('idx_inventory_log_created_at', ['createdAt'])
@Index('idx_inventory_log_order_id', ['orderId'])
export class InventoryLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'inventory_id', type: 'int', comment: '库存记录 ID' })
  inventoryId: number;

  @Column({ name: 'product_id', type: 'int', comment: '商品 ID' })
  productId: number;

  @Column({
    type: 'enum',
    enum: ['IN', 'OUT', 'RESERVE', 'RELEASE', 'ADJUST'],
    comment: '操作类型：入库/出库/预留/释放/盘点',
  })
  type: string;

  @Column({ type: 'int', comment: '变动数量（正数入库，负数出库）' })
  quantity: number;

  @Column({ name: 'before_stock', type: 'int', comment: '操作前库存' })
  beforeStock: number;

  @Column({ name: 'after_stock', type: 'int', comment: '操作后库存' })
  afterStock: number;

  @Column({ name: 'order_id', type: 'int', nullable: true, comment: '关联订单 ID' })
  orderId: number | null;

  @Column({ name: 'order_no', type: 'varchar', length: 50, nullable: true, comment: '关联订单编号' })
  orderNo: string | null;

  @Column({ name: 'operator_id', type: 'int', nullable: true, comment: '操作人 ID' })
  operatorId: number | null;

  @Column({ name: 'operator_name', type: 'varchar', length: 100, nullable: true, comment: '操作人姓名' })
  operatorName: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
  remark: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
