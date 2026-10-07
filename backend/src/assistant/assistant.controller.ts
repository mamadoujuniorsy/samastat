import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { StaffGuard } from '../auth/staff.guard.js';
import { AnswersService } from './answers.service.js';
import { AssistantService } from './assistant.service.js';
import { LlmService } from '../llm/llm.service.js';
import { IndicatorsRepository } from '../indicators/indicators.repository.js';
import { SurveysRepository } from '../indicators/surveys.repository.js';
import { EmbeddingsService } from '../indicators/embeddings.service.js';
import { TranslationService } from '../wolof/translation.service.js';
import { TranscriptionService } from '../wolof/transcription.service.js';
import { WolofTtsService } from '../wolof/wolof-tts.service.js';
import { formatValue } from './answer-renderer.js';
import { AskRequest, type AskEvent, type AskResponse, type HistoryTurn } from './assistant.types.js';
import { buildChart } from './chart.js';
import { UsageLogService } from './usage-log.service.js';

const MAX_QUESTION_LENGTH = 500;
const CSV_SPECIAL = /[";\r\n]/;
const CRLF = '\r\n';
const BOM = '﻿';

@ApiTags('SamaStat')
@Controller()
export class AssistantController {
  constructor(
    private readonly llm: LlmService,
    private readonly assistant: AssistantService,
    private readonly indicators: IndicatorsRepository,
    private readonly surveys: SurveysRepository,
    private readonly usage: UsageLogService,
    private readonly answers: AnswersService,
    private readonly embeddings: EmbeddingsService,
    private readonly translation: TranslationService,
    private readonly transcription: TranscriptionService,
    private readonly tts: WolofTtsService,
  ) {}

  @Get('health')
  @SkipThrottle()
  @ApiOperation({ summary: 'État du service et taille des index' })
  async health() {
    const [indicators, indexed, surveys] = await Promise.all([
      this.indicators.count(),
      this.indicators.countIndexed(),
      this.surveys.count(),
    ]);
    return {
      ok: true,
      indicators,
      indexed,
      surveys: surveys.total,
      surveysIndexed: surveys.indexed,
      models: {
        embeddings: this.embeddings.loaded,
        translation: this.translation.available,
        transcription: this.transcription.available,
        wolofTts: this.tts.available,
      },
      llm: {
        primary: this.llm.primary ? { provider: this.llm.primary.name, model: this.llm.primary.model } : null,
        fallback: this.llm.fallback ? { provider: this.llm.fallback.name, model: this.llm.fallback.model } : null,
      },
    };
  }

  @Get('indicators')
  @ApiOperation({ summary: 'Catalogue résumé des indicateurs (sans valeurs)' })
  async catalogue() {
    return { indicators: await this.indicators.listAll(500) };
  }

  @Get('catalogue')
  @ApiOperation({ summary: 'Navigation dans le catalogue complet, valeurs et sources comprises' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'level', required: false, description: 'national | region | departement | commune' })
  @ApiQuery({ name: 'q', required: false, description: 'Filtre texte' })
  async browse(@Query('domain') domain?: string, @Query('level') level?: string, @Query('q') q?: string) {
    const [records, domains] = await Promise.all([this.indicators.browse({ domain, level, q }), this.indicators.domains()]);
    return {
      domains,
      records: records.map((r) => ({ ...r, formattedValue: formatValue(r) })),
    };
  }

  @Get('indicators/:id')
  @ApiOperation({ summary: "Fiche d'un indicateur : enregistrement, autres territoires et périodes, graphique" })
  @ApiParam({ name: 'id', example: 'rgph5-2023-population-region-dakar' })
  async indicator(@Param('id') id: string) {
    const record = await this.indicators.getById(id);
    if (!record) throw new NotFoundException('Indicateur inconnu.');
    const related = await this.indicators.related(record.name, record.unit);
    const sameTerritory = related.filter((r) => r.territory === record.territory);
    const samePeriod = related.filter((r) => r.period === record.period);
    return {
      record: { ...record, formattedValue: formatValue(record) },
      byPeriod: sameTerritory.map((r) => ({ ...r, formattedValue: formatValue(r) })),
      byTerritory: samePeriod.map((r) => ({ ...r, formattedValue: formatValue(r) })),
      evolution: buildChart(sameTerritory),
      comparison: buildChart(samePeriod),
      citation: `ANSD, « ${record.name} », ${record.territory}, ${record.period}. ${record.source}. ${record.url} (consulté le ${new Date().toISOString().slice(0, 10)}).`,
    };
  }

  @Get('answers/:id')
  @ApiOperation({ summary: 'Réponse partageable par identifiant court (lien permanent)' })
  @ApiParam({ name: 'id', example: 'k7m2p9xq' })
  async answer(@Param('id') id: string) {
    const found = await this.answers.get(id);
    if (!found) throw new NotFoundException('Réponse inconnue.');
    return found;
  }

  @Get('stats')
  @UseGuards(StaffGuard)
  @ApiBearerAuth('staff')
  @ApiOperation({ summary: "Tableau de bord d'usage (personnel ANSD) : agrégats anonymes des questions posées" })
  @ApiQuery({ name: 'days', required: false, description: 'Fenêtre en jours (1-365, défaut 30)' })
  async stats(@Query('days') days?: string) {
    const n = Math.min(Math.max(Number(days) || 30, 1), 365);
    return this.usage.stats(n);
  }

  @Get('stats/questions.csv')
  @UseGuards(StaffGuard)
  @ApiBearerAuth('staff')
  @ApiOperation({ summary: "Export CSV des questions (anonymes) avec statut, pour analyse par l'ANSD" })
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'status', required: false, description: 'answered | no_data | conversation | error' })
  async questionsCsv(@Query('days') days: string | undefined, @Query('status') status: string | undefined, @Res() res: Response) {
    const n = Math.min(Math.max(Number(days) || 30, 1), 365);
    const rows = await this.usage.questions(n, status);
    const cell = (v: string) => (CSV_SPECIAL.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      'date;statut;langue;question;indicateurs',
      ...rows.map((r) => [r.day, r.status, r.language, cell(r.question), r.indicatorIds.join(' ')].join(';')),
    ];
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="samastat-questions-${n}j.csv"`)
      .send(BOM + lines.join(CRLF) + CRLF);
  }

  @Post('ask')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Poser une question en langage naturel',
    description:
      "Le modèle de langage sélectionne l'indicateur et formule la phrase ; chaque valeur provient d'un enregistrement de la base et est accompagnée de sa source, sa période et l'horodatage de récupération. Sans donnée correspondante, status = no_data avec des reformulations.",
  })
  @ApiBody({ type: AskRequest })
  @ApiOkResponse({ description: 'Réponse sourcée (voir README pour le schéma détaillé)' })
  async ask(@Body() body: { question?: unknown; history?: unknown }): Promise<AskResponse> {
    return this.assistant.ask(parseRequest(body));
  }

  /**
   * Même traitement, en flux Server-Sent Events : les étapes (recherche, récupération, garde)
   * sont envoyées au fur et à mesure, puis la réponse complète.
   */
  @Post('ask/stream')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Poser une question, réponse en flux SSE (événements step, answer, error)' })
  @ApiBody({ type: AskRequest })
  async askStream(@Body() body: { question?: unknown; history?: unknown }, @Req() req: Request, @Res() res: Response) {
    const request = parseRequest(body);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });
    const send = (event: AskEvent) => {
      if (closed) return;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    const heartbeat = setInterval(() => !closed && res.write(': ping\n\n'), 10_000);

    try {
      await this.assistant.ask(request, send);
    } catch (err) {
      send({ type: 'error', message: (err as Error).message });
    } finally {
      clearInterval(heartbeat);
      if (!closed) res.end();
    }
  }
}

function parseRequest(body: { question?: unknown; history?: unknown; language?: unknown }): AskRequest {
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (question.length < 2) throw new BadRequestException('La question est vide.');
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new BadRequestException(`La question dépasse ${MAX_QUESTION_LENGTH} caractères.`);
  }
  const history = Array.isArray(body.history) ? (body.history as unknown[]).filter(isHistoryTurn).slice(-20) : undefined;
  const language = body.language === 'wo' || body.language === 'fr' ? body.language : undefined;
  return { question, history, language };
}

function isHistoryTurn(t: unknown): t is HistoryTurn {
  return (
    typeof t === 'object' &&
    t !== null &&
    ((t as HistoryTurn).role === 'user' || (t as HistoryTurn).role === 'assistant') &&
    typeof (t as HistoryTurn).text === 'string'
  );
}
