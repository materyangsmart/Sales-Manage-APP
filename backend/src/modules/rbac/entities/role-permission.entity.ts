import {
  Entity,
  Column,
  CreateDateColumn,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * 角色-权限关联表（纯关联表，无自增 ID）
 *
 * 注意：TypeORM 的 @JoinTable 会自动管理 role_permissions 表，
 * 但此处显式定义是为了允许直接查询权限分配关系。
 * 使用复合主键（role_id + permission_id）避免与 @JoinTable 冲突。
 */
@Entity('role_permissions')
@Index(['roleId', 'permissionId'], { unique: true })
export class RolePermission {
  @PrimaryColumn({ name: 'role_id', type: 'int', comment: '角色ID' })
  roleId: number;

  @PrimaryColumn({ name: 'permission_id', type: 'int', comment: '权限ID' })
  permissionId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
