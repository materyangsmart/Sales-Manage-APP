import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('products')
@Index('idx_products_org', ['orgId'])
@Index('idx_products_sku', ['sku'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'org_id', type: 'int', comment: '组织ID' })
  orgId: number;

  @Column({
    name: 'sku',
    type: 'varchar',
    length: 50,
    unique: true,
    comment: 'SKU编码',
  })
  sku: string;

  @Column({ name: 'product_name', type: 'varchar', length: 200, comment: '产品名称' })
  productName: string;

  @Column({ name: 'category', type: 'varchar', length: 100, nullable: true, comment: '产品类别' })
  category: string | null;

  @Column({ name: 'unit', type: 'varchar', length: 20, default: '件', comment: '单位' })
  unit: string;

  @Column({
    name: 'unit_price',
    type: 'int',
    comment: '单价（分）',
  })
  unitPrice: number;

  @Column({
    name: 'stock_quantity',
    type: 'int',
    default: 0,
    comment: '库存数量',
  })
  stockQuantity: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE', 'DISCONTINUED'],
    default: 'ACTIVE',
    comment: '状态：ACTIVE-在售, INACTIVE-停售, DISCONTINUED-停产',
  })
  status: string;

  @Column({ name: 'description', type: 'text', nullable: true, comment: '产品描述' })
  description: string | null;

  @Column({ name: 'created_by', type: 'int', comment: '创建人ID' })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;
}
