import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('production_plans')
@Index(['batchNo'], { unique: true })
@Index(['productionDate'])
export class ProductionPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'batch_no', type: 'varchar', length: 50, comment: '生产批次号' })
  batchNo: string;

  @Column({ name: 'product_name', type: 'varchar', length: 200, comment: '产品名称' })
  productName: string;

  @Column({ name: 'planned_quantity', type: 'int', comment: '计划产量' })
  plannedQuantity: number;

  @Column({ name: 'actual_quantity', type: 'int', nullable: true, comment: '实际产量' })
  actualQuantity: number;

  @Column({ name: 'raw_material', type: 'varchar', length: 200, nullable: true, comment: '原料来源' })
  rawMaterial: string;

  @Column({ name: 'raw_material_batch', type: 'varchar', length: 100, nullable: true, comment: '原料批次' })
  rawMaterialBatch: string;

  @Column({ name: 'production_date', type: 'date', comment: '生产日期' })
  productionDate: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true, comment: '保质期截止' })
  expiryDate: Date;

  @Column({ name: 'quality_inspector', type: 'varchar', length: 50, nullable: true, comment: '质检员' })
  qualityInspector: string;

  @Column({ name: 'quality_result', type: 'enum', enum: ['PASS', 'FAIL', 'PENDING'], default: 'PENDING', comment: '质检结果' })
  qualityResult: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
