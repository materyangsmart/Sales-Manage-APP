import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 消息模板表
 * 存储系统中所有消息类型的标题和内容模板
 * 模板变量使用 {{variable}} 格式，运行时替换
 */
@Entity('message_templates')
@Index(['code'], { unique: true })
export class MessageTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 模板代码（唯一标识）
   * 例如：WORKFLOW_PENDING（审批待办）、RADAR_ALERT（预警）、ORDER_APPROVED（订单审批通过）
   */
  @Column({ type: 'varchar', length: 100 })
  code: string;

  /**
   * 模板名称（人类可读）
   */
  @Column({ type: 'varchar', length: 200 })
  name: string;

  /**
   * 标题模板（支持变量替换）
   * 例如：'【待审批】{{businessType}} 单据 #{{businessId}} 需要您的审批'
   */
  @Column({ type: 'varchar', length: 500 })
  titleTemplate: string;

  /**
   * 内容模板（支持变量替换）
   * 例如：'{{submitterName}} 于 {{submitTime}} 提交了一个 {{businessType}} 申请，请您及时处理。'
   */
  @Column({ type: 'text' })
  contentTemplate: string;

  /**
   * 消息类型
   */
  @Column({
    type: 'enum',
    enum: ['SYSTEM', 'APPROVAL', 'ALERT'],
    default: 'SYSTEM',
  })
  type: 'SYSTEM' | 'APPROVAL' | 'ALERT';

  /**
   * 是否启用
   */
  @Column({ type: 'tinyint', default: 1 })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
