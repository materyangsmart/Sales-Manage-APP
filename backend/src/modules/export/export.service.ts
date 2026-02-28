/**
 * 导出服务
 *
 * 职责：
 * 1. 接收导出请求，立即创建任务记录，返回 taskId（HTTP 202）
 * 2. 将任务推入 BullMQ 队列，由 ExportWorker 后台异步处理
 * 3. 提供任务状态查询接口
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { ExportTask, ExportTaskStatus, ExportTaskType } from './entities/export-task.entity';
import { EXPORT_QUEUE_NAME, EXPORT_JOB_NAME, ExportJobData } from './export.worker';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(ExportTask)
    private readonly taskRepo: Repository<ExportTask>,
    @InjectQueue(EXPORT_QUEUE_NAME)
    private readonly exportQueue: Queue,
  ) {}

  /**
   * 提交导出任务
   * 立即返回 taskId，后台异步处理
   *
   * @returns { taskId, message } - HTTP 202 Accepted
   */
  async submitExportTask(params: {
    taskType: ExportTaskType;
    requesterId: number;
    requesterName?: string;
    queryParams?: Record<string, any>;
  }): Promise<{ taskId: string; message: string; estimatedSeconds: number }> {
    const taskId = uuidv4();

    // 创建任务记录
    const task = this.taskRepo.create({
      taskId,
      taskType: params.taskType,
      requesterId: params.requesterId,
      requesterName: params.requesterName ?? null,
      queryParams: params.queryParams ? JSON.stringify(params.queryParams) : null,
      status: ExportTaskStatus.PENDING,
      progress: 0,
    });
    await this.taskRepo.save(task);

    // 推入 BullMQ 队列
    const jobData: ExportJobData = {
      taskId,
      taskType: params.taskType,
      requesterId: params.requesterId,
      queryParams: params.queryParams ?? {},
    };

    await this.exportQueue.add(EXPORT_JOB_NAME, jobData, {
      attempts: 3,           // 失败重试 3 次
      backoff: {
        type: 'exponential',
        delay: 5000,         // 指数退避，从 5 秒开始
      },
      removeOnComplete: 50,  // 保留最近 50 条完成记录
      removeOnFail: 20,      // 保留最近 20 条失败记录
    });

    this.logger.log(
      `[ExportService] 导出任务已提交: taskId=${taskId}, type=${params.taskType}, requester=${params.requesterId}`,
    );

    return {
      taskId,
      message: `导出任务已提交，正在后台处理中，请通过 taskId 轮询状态`,
      estimatedSeconds: 30,
    };
  }

  /**
   * 查询任务状态
   */
  async getTaskStatus(taskId: string): Promise<ExportTask> {
    const task = await this.taskRepo.findOne({ where: { taskId } });
    if (!task) {
      throw new NotFoundException(`导出任务 ${taskId} 不存在`);
    }
    return task;
  }

  /**
   * 查询用户的导出历史
   */
  async getUserTasks(requesterId: number, limit = 20): Promise<ExportTask[]> {
    return this.taskRepo.find({
      where: { requesterId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
