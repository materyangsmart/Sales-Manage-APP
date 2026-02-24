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
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'org_id', type: 'int', comment: '组织ID' })
  orgId: number;

  @Column({ length: 50, unique: true, comment: '用户名' })
  username: string;

  @Column({ name: 'real_name', length: 50, comment: '真实姓名' })
  realName: string;

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
    comment: '角色列表（自动根据职位映射）',
  })
  roles: string[];

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'DISABLED'],
    default: 'ACTIVE',
    comment: '状态',
  })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
