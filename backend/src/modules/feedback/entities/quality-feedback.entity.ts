import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('quality_feedback')
@Index(['orderId'])
export class QualityFeedback {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', comment: '关联订单ID' })
  orderId: number;

  @Column({ type: 'int', default: 5, comment: '评分（1-5星）' })
  rating: number;

  @Column({ type: 'text', nullable: true, comment: '评价内容' })
  comment: string;

  @Column({ type: 'simple-array', nullable: true, comment: '图片URL列表' })
  images: string[];

  @Column({ name: 'customer_name', type: 'varchar', length: 100, nullable: true, comment: '评价人姓名' })
  customerName: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 20, nullable: true, comment: '评价人电话' })
  customerPhone: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
