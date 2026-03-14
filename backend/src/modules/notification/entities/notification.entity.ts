import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { UserNotification } from './user-notification.entity';

/**
 * 通知主体表
 * 记录系统生成的每一条具体通知内容
 * 一条 Notification 可以触达多个用户（通过 UserNotification 关联）
 */
@Entity('notifications')
@Index(['businessType', 'businessId'])
@Index(['type'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 通知类型
   * SYSTEM: 系统通知（如维护公告）
   * APPROVAL: 审批相关通知（待审批、审批结果）
   * ALERT: 预警通知（CEORadar 异动、信用风险）
   */
  @Column({
    type: 'enum',
    enum: ['SYSTEM', 'APPROVAL', 'ALERT'],
    default: 'SYSTEM',
  })
  type: 'SYSTEM' | 'APPROVAL' | 'ALERT';

  /**
   * 通知标题（已渲染，变量已替换）
   */
  @Column({ type: 'varchar', length: 500 })
  title: string;

  /**
   * 通知内容（已渲染，变量已替换）
   */
  @Column({ type: 'text' })
  content: string;

  /**
   * 关联的业务单据类型（如 'ORDER', 'WORKFLOW', 'CUSTOMER'）
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  businessType: string | null;

  /**
   * 关联的业务单据 ID
   */
  @Column({ type: 'int', nullable: true })
  businessId: number | null;

  /**
   * 触发通知的来源（如工作流实例 ID、预警规则 ID）
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  sourceRef: string | null;

  /**
   * 额外的元数据（JSON 格式，存储模板变量等）
   */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  /**
   * 用户触达记录（一对多）
   */
  @OneToMany(() => UserNotification, (un) => un.notification)
  userNotifications: UserNotification[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
