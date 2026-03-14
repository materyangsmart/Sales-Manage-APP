import { Module } from '@nestjs/common';
import { CeoRadarController } from './controllers/ceo-radar.controller';
import { CeoRadarService } from './services/ceo-radar.service';

@Module({
  controllers: [CeoRadarController],
  providers: [CeoRadarService],
  exports: [CeoRadarService],
})
export class CeoRadarModule {}
