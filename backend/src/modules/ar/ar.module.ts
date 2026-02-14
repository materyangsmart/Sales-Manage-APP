import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ARController } from './controllers/ar.controller';
import { AuditLogController } from './controllers/audit-log.controller';
import { ARService } from './services/ar.service';
import { AuditLogService } from './services/audit-log.service';
import { ARInvoice } from './entities/ar-invoice.entity';
import { ARPayment } from './entities/ar-payment.entity';
import { ARApply } from './entities/ar-apply.entity';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ARInvoice, ARPayment, ARApply, AuditLog]),
  ],
  controllers: [ARController, AuditLogController],
  providers: [ARService, AuditLogService],
  exports: [ARService],
})
export class ARModule {}
