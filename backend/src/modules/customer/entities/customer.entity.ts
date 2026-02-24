import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
// import { Organization } from '../../order/entities/organization.entity'; // TODO: Add organization entity

export enum CustomerCategory {
  WET_MARKET = 'WET_MARKET',       // 菜市场类
  WHOLESALE_B = 'WHOLESALE_B',     // 批发商B类
  SUPERMARKET = 'SUPERMARKET',     // 商超类
  ECOMMERCE = 'ECOMMERCE',         // 电商类
  DEFAULT = 'DEFAULT',             // 默认类型
}

@Entity('customers')
@Index(['orgId'])
@Index(['category'])
@Index(['createdAt'])
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'org_id' })
  orgId: number;

  // @ManyToOne(() => Organization)
  // @JoinColumn({ name: 'org_id' })
  // organization: Organization; // TODO: Add organization relation

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'customer_code', length: 50, unique: true })
  customerCode: string;

  @Column({
    type: 'enum',
    enum: CustomerCategory,
    default: CustomerCategory.DEFAULT,
  })
  category: CustomerCategory;

  @Column({ length: 50, nullable: true })
  contact: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
