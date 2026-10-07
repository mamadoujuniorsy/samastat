import { Module } from '@nestjs/common';
import { IndicatorsModule } from '../indicators/indicators.module.js';
import { IndexingController } from './indexing.controller.js';
import { IndexingService } from './indexing.service.js';

@Module({
  imports: [IndicatorsModule],
  controllers: [IndexingController],
  providers: [IndexingService],
})
export class IndexingModule {}
