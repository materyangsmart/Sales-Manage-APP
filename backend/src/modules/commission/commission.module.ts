import { Module } from '@nestjs/common';
import { CommissionController } from './controllers/commission.controller';
import { CommissionService } from './services/commission.service';

@Module({
  controllers: [CommissionController],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionModule {}
