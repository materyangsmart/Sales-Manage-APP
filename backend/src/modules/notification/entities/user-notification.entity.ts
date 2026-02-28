import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Notification } from './notification.entity';

/**
 * 用户消息触达表
 * 管理每个用户对每条通知的阅读状态
 * 一条 Notification 可以对应多个 UserNotification（群发场景）
 */
@Entity('user_notifications')
@Index(['userId', 'isRead'])
@Index(['userId', 'notificationId'], { unique: true })
export class UserNotification {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 接收通知的用户 ID
   */
  @Column({ type: 'int' })
  userId: number;

  /**
   * 关联的通知 ID
   */
  @Column({ type: 'int' })
  notificationId: number;

  /**
   * 是否已读
   */
  @Column({ type: 'tinyint', default: 0 })
  isRead: boolean;

  /**
   * 已读时间
   */
  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null;

  /**
   * 通知优先级（HIGH/NORMAL/LOW）
   */
  @Column({
    type: 'enum',
    enum: ['HIGH', 'NORMAL', 'LOW'],
    default: 'NORMAL',
  })
  priority: 'HIGH' | 'NORMAL' | 'LOW';

  /**
   * 关联通知主体（多对一）
   */
  @ManyToOne(() => Notification, (n) => n.userNotifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notificationId' })
  notification: Notification;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
