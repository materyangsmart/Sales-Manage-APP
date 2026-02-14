import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('customers')
@Index('idx_customers_org', ['orgId'])
@Index('idx_customers_code', ['customerCode'], { unique: true })
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'org_id', type: 'int', comment: '组织ID' })
  orgId: number;

  @Column({
    name: 'customer_code',
    type: 'varchar',
    length: 50,
    unique: true,
    comment: '客户编码',
  })
  customerCode: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 200, comment: '客户名称' })
  customerName: string;

  @Column({ name: 'contact_person', type: 'varchar', length: 100, nullable: true, comment: '联系人' })
  contactPerson: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 50, nullable: true, comment: '联系电话' })
  contactPhone: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 100, nullable: true, comment: '联系邮箱' })
  contactEmail: string | null;

  @Column({ name: 'address', type: 'text', nullable: true, comment: '地址' })
  address: string | null;

  @Column({
    name: 'credit_limit',
    type: 'int',
    default: 0,
    comment: '信用额度（分）',
  })
  creditLimit: number;

  @Column({
    name: 'used_credit',
    type: 'int',
    default: 0,
    comment: '已用信用额度（分）',
  })
  usedCredit: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
    default: 'ACTIVE',
    comment: '状态：ACTIVE-活跃, INACTIVE-不活跃, BLOCKED-冻结',
  })
  status: string;

  @Column({ name: 'created_by', type: 'int', comment: '创建人ID' })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;
}
