import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Permission } from './permission.entity';

/**
 * 数据范围枚举（核心！控制用户能看到哪些数据）
 *
 * ALL          - 全部数据（CEO、总监级别）
 * DEPT_AND_SUB - 本部门及子部门（大区总监、城市经理）
 * DEPT         - 仅本部门（战区长）
 * SELF         - 仅本人数据（一线销售）
 * CUSTOM       - 自定义部门（特殊配置）
 */
export enum DataScope {
  ALL = 'ALL',
  DEPT_AND_SUB = 'DEPT_AND_SUB',
  DEPT = 'DEPT',
  SELF = 'SELF',
  CUSTOM = 'CUSTOM',
}

@Entity('roles')
@Index(['code'], { unique: true })
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, comment: '角色名称（如：一线销售、华东区总监）' })
  name: string;

  @Column({ type: 'varchar', length: 50, comment: '角色编码（如：SALES_REP、REGION_DIRECTOR）' })
  code: string;

  /**
   * 数据范围：决定该角色能查看多大范围的数据
   * SELF       → WHERE sales_rep_id = :userId
   * DEPT       → WHERE org_id = :orgId
   * DEPT_AND_SUB → WHERE org_id IN (本部门及所有子部门IDs)
   * ALL        → 不加 WHERE 限制
   */
  @Column({
    name: 'data_scope',
    type: 'enum',
    enum: DataScope,
    default: DataScope.SELF,
    comment: '数据范围：ALL全部, DEPT_AND_SUB本部门及子部门, DEPT本部门, SELF仅本人',
  })
  dataScope: DataScope;

  @Column({ type: 'text', nullable: true, comment: '角色描述' })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'DISABLED'],
    default: 'ACTIVE',
    comment: '状态',
  })
  status: string;

  @Column({ name: 'sort_order', type: 'int', default: 0, comment: '排序权重' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 角色 ↔ 权限 多对多关联
  @ManyToMany(() => Permission, (permission) => permission.roles, { eager: false })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];
}
