import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module.js';
import { TelegramController } from './telegram.controller.js';
import { TelegramService } from './telegram.service.js';

@Module({
  imports: [AssistantModule],
  controllers: [TelegramController],
  providers: [TelegramService],
})
export class TelegramModule {}
