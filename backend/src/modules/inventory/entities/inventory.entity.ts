import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Inventory - 库存实体（RC4 WMS + RC5 ATP 可承诺量）
 * ATP = physical_stock + daily_idle_capacity - pending_delivery - locked_capacity
 */
@Entity('inventory')
@Index('idx_inventory_product_id', ['productId'], { unique: true })
@Index('idx_inventory_low_stock', ['availableStock'])
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id', type: 'int', comment: '商品 ID（关联 product_catalog）' })
  productId: number;

  @Column({ name: 'product_name', type: 'varchar', length: 200, comment: '商品名称（冗余）' })
  productName: string;

  @Column({ name: 'sku', type: 'varchar', length: 100, nullable: true, comment: 'SKU 编码' })
  sku: string | null;

  @Column({ name: 'total_stock', type: 'int', default: 0, comment: '总库存（物理库存）' })
  totalStock: number;

  @Column({ name: 'available_stock', type: 'int', default: 0, comment: '可用库存（物理库存）' })
  availableStock: number;

  @Column({ name: 'reserved_stock', type: 'int', default: 0, comment: '已预留库存' })
  reservedStock: number;

  @Column({ name: 'low_stock_threshold', type: 'int', default: 10, comment: '低库存预警阈值' })
  lowStockThreshold: number;

  @Column({ name: 'unit', type: 'varchar', length: 20, default: '件', comment: '单位' })
  unit: string;

  @Column({ name: 'warehouse_location', type: 'varchar', length: 100, nullable: true, comment: '仓库位置' })
  warehouseLocation: string | null;

  // ── ATP 可承诺量字段（RC5 新增）──────────────────────────────────────────
  @Column({ name: 'pending_delivery', type: 'int', default: 0, comment: '待交付量（已接单未发货）' })
  pendingDelivery: number;

  @Column({ name: 'locked_capacity', type: 'int', default: 0, comment: '锁定配额（大客户预留产能）' })
  lockedCapacity: number;

  @Column({ name: 'daily_idle_capacity', type: 'int', default: 0, comment: '每日剩余闲置产能' })
  dailyIdleCapacity: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
