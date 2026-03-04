import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Lead - 意向线索实体（RC3 Open API /api/v1/leads 收集）
 */
@Entity('leads')
@Index('idx_leads_source', ['source'])
@Index('idx_leads_status', ['status'])
@Index('idx_leads_created_at', ['createdAt'])
export class Lead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_name', type: 'varchar', length: 200, comment: '公司名称' })
  companyName: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 100, comment: '联系人姓名' })
  contactName: string;

  @Column({ name: 'contact_phone', type: 'varchar', length: 50, comment: '联系电话' })
  contactPhone: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 200, nullable: true, comment: '联系邮箱' })
  contactEmail: string | null;

  @Column({
    type: 'enum',
    enum: ['Website', 'Mobile', 'Referral', 'Exhibition', 'Other'],
    default: 'Website',
    comment: '线索来源',
  })
  source: string;

  @Column({ type: 'text', nullable: true, comment: '需求描述' })
  message: string | null;

  @Column({
    type: 'enum',
    enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'],
    default: 'NEW',
    comment: '线索状态',
  })
  status: string;

  @Column({ name: 'assigned_to', type: 'int', nullable: true, comment: '分配给的销售员 ID' })
  assignedTo: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
