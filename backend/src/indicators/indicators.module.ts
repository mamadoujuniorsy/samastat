import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service.js';
import { ExportController } from './export.controller.js';
import { IndicatorsRepository } from './indicators.repository.js';
import { SurveysRepository } from './surveys.repository.js';

@Module({
  controllers: [ExportController],
  providers: [EmbeddingsService, IndicatorsRepository, SurveysRepository],
  exports: [IndicatorsRepository, SurveysRepository, EmbeddingsService],
})
export class IndicatorsModule {}
