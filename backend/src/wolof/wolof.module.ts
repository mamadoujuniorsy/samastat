import { Module } from '@nestjs/common';
import { TranscriptionService } from './transcription.service.js';
import { TranslationService } from './translation.service.js';
import { WolofController } from './wolof.controller.js';
import { WolofTtsService } from './wolof-tts.service.js';

@Module({
  controllers: [WolofController],
  providers: [TranslationService, TranscriptionService, WolofTtsService],
  exports: [TranslationService, TranscriptionService, WolofTtsService],
})
export class WolofModule {}
