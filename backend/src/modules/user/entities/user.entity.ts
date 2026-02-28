import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  AUDITOR = 'AUDITOR',
  SALES = 'SALES',
  FINANCE = 'FINANCE',
  LOGISTICS = 'LOGISTICS',
}

export enum JobPosition {
  CEO = 'CEO',
  SALES_DIRECTOR = 'SALES_DIRECTOR',
  SALES_MANAGER = 'SALES_MANAGER',
  SALES_REP = 'SALES_REP',
  FINANCE_SUPERVISOR = 'FINANCE_SUPERVISOR',
  FINANCE_CLERK = 'FINANCE_CLERK',
  LOGISTICS_MANAGER = 'LOGISTICS_MANAGER',
  WAREHOUSE_CLERK = 'WAREHOUSE_CLERK',
}

/**
 * 职位 → 角色自动映射表
 * 创建员工时根据职位自动注入角色，杜绝人为干扰
 */
export const POSITION_ROLE_MAP: Record<JobPosition, UserRole[]> = {
  [JobPosition.CEO]: [UserRole.ADMIN],
  [JobPosition.SALES_DIRECTOR]: [UserRole.ADMIN, UserRole.SALES],
  [JobPosition.SALES_MANAGER]: [UserRole.OPERATOR, UserRole.SALES],
  [JobPosition.SALES_REP]: [UserRole.SALES],
  [JobPosition.FINANCE_SUPERVISOR]: [UserRole.FINANCE, UserRole.AUDITOR],
  [JobPosition.FINANCE_CLERK]: [UserRole.FINANCE],
  [JobPosition.LOGISTICS_MANAGER]: [UserRole.LOGISTICS, UserRole.OPERATOR],
  [JobPosition.WAREHOUSE_CLERK]: [UserRole.LOGISTICS],
};

@Entity('users')
@Index(['orgId'])
@Index(['username'], { unique: true })
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 所属组织ID（关联 organizations 表）
   * 决定该用户属于哪个部门/战区/城市/大区
   */
  @Column({ name: 'org_id', type: 'int', comment: '所属组织ID（关联 organizations 表）' })
  orgId: number;

  @Column({ length: 50, comment: '用户名（登录名）' })
  username: string;

  @Column({ name: 'real_name', length: 50, comment: '真实姓名' })
  realName: string;

  /**
   * 邮箱（用于 JWT 登录认证）
   */
  @Column({ type: 'varchar', length: 100, nullable: true, unique: true, comment: '邮箱（登录账号）' })
  email: string | null;

  /**
   * 密码哈希（bcrypt）
   */
  @Column({ name: 'password_hash', type: 'varchar', length: 200, nullable: true, comment: '密码哈希（bcrypt）' })
  passwordHash: string | null;

  @Column({ length: 20, nullable: true, comment: '手机号' })
  phone: string;

  @Column({
    name: 'job_position',
    type: 'enum',
    enum: JobPosition,
    comment: '职位',
  })
  jobPosition: JobPosition;

  @Column({
    type: 'simple-array',
    nullable: true,
    default: null,
    comment: '角色列表（自动根据职位映射）',
  })
  roles: string[] | null;

  /**
   * 账号状态
   * ACTIVE   - 正常启用
   * DISABLED - 已禁用（禁止登录）
   * LOCKED   - 已锁定（多次登录失败）
   */
  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'DISABLED', 'LOCKED'],
    default: 'ACTIVE',
    comment: '账号状态：ACTIVE=启用, DISABLED=禁用, LOCKED=锁定',
  })
  status: string;

  /**
   * 最后登录时间
   */
  @Column({ name: 'last_login_at', type: 'datetime', nullable: true, comment: '最后登录时间' })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
