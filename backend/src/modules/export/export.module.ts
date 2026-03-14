import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ExportTask } from './entities/export-task.entity';
import { ExportService } from './export.service';
import { ExportWorker, EXPORT_QUEUE_NAME } from './export.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExportTask]),
    BullModule.registerQueue({
      name: EXPORT_QUEUE_NAME,
      // Redis 连接由 app.module.ts 中的 BullModule.forRootAsync 统一配置
    }),
  ],
  providers: [ExportService, ExportWorker],
  exports: [ExportService],
})
export class ExportModule {}
