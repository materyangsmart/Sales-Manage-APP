import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

/**
 * 组织层级枚举
 * 总公司(1) → 大区(2) → 城市(3) → 战区(4)
 */
export enum OrgLevel {
  COMPANY = 1,   // 总公司
  REGION = 2,    // 大区（如华东区）
  CITY = 3,      // 城市（如上海）
  ZONE = 4,      // 战区（如浦东战区）
}

@Entity('organizations')
@Index(['parentId'])
@Index(['level'])
@Index(['code'], { unique: true })
export class Organization {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, comment: '组织名称' })
  name: string;

  @Column({ type: 'varchar', length: 50, comment: '组织编码（如 HQ / EAST / SH / PD）' })
  code: string;

  @Column({
    name: 'parent_id',
    type: 'int',
    nullable: true,
    comment: '父级组织ID，顶级为 NULL',
  })
  parentId: number | null;

  @Column({
    type: 'int',
    comment: '层级：1=总公司, 2=大区, 3=城市, 4=战区',
  })
  level: number;

  /**
   * 祖先路径，格式：/1/2/5/（方便快速查询子树）
   * 例如：华东区路径为 /1/2/，上海为 /1/2/3/
   */
  @Column({
    name: 'ancestor_path',
    length: 500,
    default: '/',
    comment: '祖先路径，如 /1/2/3/，用于快速子树查询',
  })
  ancestorPath: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'DISABLED'],
    default: 'ACTIVE',
    comment: '状态',
  })
  status: string;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0, comment: '排序权重' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ─── 关联关系（用于树形查询，不影响表结构）──────────────────────────────
  @ManyToOne(() => Organization, (org) => org.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Organization;

  @OneToMany(() => Organization, (org) => org.parent)
  children: Organization[];
}
