import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['resourceType', 'resourceId'])
@Index(['userId', 'createdAt'])
@Index(['idempotencyKey'], {
  unique: true,
  where: 'idempotency_key IS NOT NULL',
})
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({
    name: 'user_id',
    type: 'bigint',
    nullable: true,
    comment: '操作用户ID',
  })
  userId: number | null;

  @Column({ name: 'action', type: 'varchar', length: 50, comment: '操作类型' })
  action: string;

  @Column({
    name: 'resource_type',
    type: 'varchar',
    length: 50,
    comment: '资源类型',
  })
  resourceType: string;

  @Column({
    name: 'resource_id',
    type: 'varchar',
    length: 100,
    comment: '资源ID',
  })
  resourceId: string;

  @Column({ name: 'old_value', type: 'json', nullable: true, comment: '旧值' })
  oldValue: any;

  @Column({ name: 'new_value', type: 'json', nullable: true, comment: '新值' })
  newValue: any;

  @Column({
    name: 'ip_address',
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'IP地址',
  })
  ipAddress: string | null;

  @Column({
    name: 'user_agent',
    type: 'text',
    nullable: true,
    comment: 'User Agent',
  })
  userAgent: string | null;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '幂等键',
  })
  idempotencyKey: string | null;

  @Column({
    name: 'response_data',
    type: 'json',
    nullable: true,
    comment: '响应数据(用于幂等返回)',
  })
  responseData: any;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    comment: '创建时间',
  })
  createdAt: Date;
}
