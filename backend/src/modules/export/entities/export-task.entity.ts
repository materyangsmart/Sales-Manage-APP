import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ExportTaskStatus {
  PENDING = 'PENDING',       // 等待处理
  PROCESSING = 'PROCESSING', // 处理中
  DONE = 'DONE',             // 完成
  FAILED = 'FAILED',         // 失败
}

export enum ExportTaskType {
  ORDERS = 'ORDERS',
  CUSTOMERS = 'CUSTOMERS',
  COMMISSION = 'COMMISSION',
}

@Entity('export_tasks')
@Index(['requesterId', 'status'])
@Index(['taskId'], { unique: true })
export class ExportTask {
  @PrimaryGeneratedColumn()
  id: number;

  /** 任务唯一 ID（UUID，返回给前端用于轮询） */
  @Column({ name: 'task_id', type: 'varchar', length: 64 })
  taskId: string;

  /** 导出类型 */
  @Column({
    name: 'task_type',
    type: 'enum',
    enum: ExportTaskType,
    default: ExportTaskType.ORDERS,
  })
  taskType: ExportTaskType;

  /** 任务状态 */
  @Column({
    type: 'enum',
    enum: ExportTaskStatus,
    default: ExportTaskStatus.PENDING,
  })
  status: ExportTaskStatus;

  /** 请求人 ID */
  @Column({ name: 'requester_id', type: 'int' })
  requesterId: number;

  /** 请求人姓名 */
  @Column({ name: 'requester_name', type: 'varchar', length: 64, nullable: true })
  requesterName: string | null;

  /** 查询参数（JSON 字符串） */
  @Column({ name: 'query_params', type: 'text', nullable: true })
  queryParams: string | null;

  /** 导出文件路径（完成后填写） */
  @Column({ name: 'file_path', type: 'varchar', length: 512, nullable: true })
  filePath: string | null;

  /** 导出文件名 */
  @Column({ name: 'file_name', type: 'varchar', length: 256, nullable: true })
  fileName: string | null;

  /** 导出记录总数 */
  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows: number;

  /** 错误信息（失败时填写） */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  /** 进度（0-100） */
  @Column({ name: 'progress', type: 'int', default: 0 })
  progress: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
