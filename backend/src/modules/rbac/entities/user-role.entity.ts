import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from './role.entity';

/**
 * 用户-角色关联表
 * 支持一个用户拥有多个角色
 * 支持角色在特定组织下生效（orgId 可为 null 表示全局角色）
 */
@Entity('user_roles')
@Index(['userId'])
@Index(['roleId'])
@Index(['userId', 'roleId', 'orgId'], { unique: true })
export class UserRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int', comment: '用户ID' })
  userId: number;

  @Column({ name: 'role_id', type: 'int', comment: '角色ID' })
  roleId: number;

  /**
   * 角色生效的组织范围
   * - null：全局生效（不限组织）
   * - 指定 orgId：仅在该组织及其子组织下生效
   */
  @Column({
    name: 'org_id',
    type: 'int',
    nullable: true,
    comment: '角色生效的组织ID（null=全局）',
  })
  orgId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 关联关系
  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
