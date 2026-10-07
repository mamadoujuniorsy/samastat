import { Module } from '@nestjs/common';
import { IndicatorsModule } from '../indicators/indicators.module.js';
import { WolofModule } from '../wolof/wolof.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { AnswersService } from './answers.service.js';
import { CacheService } from './cache.service.js';
import { UsageLogService } from './usage-log.service.js';

@Module({
  imports: [IndicatorsModule, WolofModule],
  controllers: [AssistantController],
  providers: [AssistantService, UsageLogService, CacheService, AnswersService],
  exports: [AssistantService],
})
export class AssistantModule {}
