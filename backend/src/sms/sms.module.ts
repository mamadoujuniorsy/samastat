import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module.js';
import { SmsController } from './sms.controller.js';
import { SmsService } from './sms.service.js';

@Module({
  imports: [AssistantModule],
  controllers: [SmsController],
  providers: [SmsService],
})
export class SmsModule {}
