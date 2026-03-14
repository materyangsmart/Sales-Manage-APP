import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
} from 'typeorm';
import { Role } from './role.entity';

/**
 * 权限类型枚举
 */
export enum PermissionType {
  MENU = 'MENU',       // 菜单权限（控制侧边栏显示）
  BUTTON = 'BUTTON',   // 按钮权限（控制页面内操作按钮）
  API = 'API',         // API 接口权限（后端硬拦截）
}

@Entity('permissions')
@Index(['code'], { unique: true })
@Index(['type'])
@Index(['parentId'])
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, comment: '权限名称（如：查看订单）' })
  name: string;

  /**
   * 权限编码，格式：模块:操作
   * 例如：order:view, order:create, commission:edit, user:manage
   */
  @Column({ type: 'varchar', length: 100, comment: '权限编码，如 order:view' })
  code: string;

  @Column({
    type: 'enum',
    enum: PermissionType,
    comment: '权限类型：MENU=菜单, BUTTON=按钮, API=接口',
  })
  type: PermissionType;

  @Column({
    name: 'parent_id',
    type: 'int',
    nullable: true,
    comment: '父级权限ID（菜单层级）',
  })
  parentId: number | null;

  @Column({
    name: 'api_path',
    type: 'varchar',
    length: 200,
    nullable: true,
    comment: 'API 路径，如 /orders GET（API 类型时使用）',
  })
  apiPath: string | null;

  @Column({
    name: 'api_method',
    type: 'varchar',
    length: 10,
    nullable: true,
    comment: 'HTTP 方法，如 GET/POST/PUT/DELETE',
  })
  apiMethod: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0, comment: '排序权重' })
  sortOrder: number;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '权限描述' })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联关系
  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
