import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionPlan } from './entities/production-plan.entity';
import { DeliveryRecord } from './entities/delivery-record.entity';
import { TraceabilityController } from './controllers/traceability.controller';
import { TraceabilityService } from './services/traceability.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionPlan, DeliveryRecord])],
  controllers: [TraceabilityController],
  providers: [TraceabilityService],
  exports: [TraceabilityService],
})
export class TraceabilityModule {}
