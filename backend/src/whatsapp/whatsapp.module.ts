import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module.js';
import { WolofModule } from '../wolof/wolof.module.js';
import { WhatsappController } from './whatsapp.controller.js';
import { WhatsappService } from './whatsapp.service.js';

@Module({
  imports: [AssistantModule, WolofModule],
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
