import { BadRequestException, Body, Controller, Get, Post, Query, Res, ServiceUnavailableException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { TRANSLATION_MODEL, TranslationService } from './translation.service.js';
import { TranscriptionError, TranscriptionService } from './transcription.service.js';
import { WOLOF_TTS_MODEL, WolofTtsService } from './wolof-tts.service.js';

@ApiTags('Wolof')
@Controller('wolof')
export class WolofController {
  constructor(
    private readonly translation: TranslationService,
    private readonly transcription: TranscriptionService,
    private readonly tts: WolofTtsService,
  ) {}

  @Post('transcribe')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 16 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Transcription vocale en français ou wolof via Groq Whisper' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { audio: { type: 'string', format: 'binary' }, language: { type: 'string', enum: ['fr', 'wo', 'auto'] } }, required: ['audio'] } })
  async transcribe(@UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string } | undefined, @Body('language') language: string | undefined) {
    try {
      return await this.transcription.transcribe(file, language);
    } catch (err) {
      throw mapTranscriptionError(err);
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Disponibilité des services wolof (traduction, voix) et modèles utilisés' })
  status() {
    return {
      transcription: {
        enabled: this.transcription.available,
        provider: this.transcription.localAvailable ? 'local-kiriku' : 'groq',
        model: this.transcription.localAvailable ? 'AIHubSN/kiriku-ASR' : 'whisper-large-v3-turbo',
      },
      translation: { enabled: this.translation.available, model: TRANSLATION_MODEL, licence: 'CC BY-NC 4.0' },
      tts: { enabled: this.tts.available, model: WOLOF_TTS_MODEL, licence: 'CC BY-NC 4.0', experimental: true },
    };
  }

  @Post('tts')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Synthèse vocale wolof : texte → audio WAV 16 kHz (expérimental)' })
  @ApiBody({ schema: { type: 'object', properties: { text: { type: 'string', maxLength: 400 } }, required: ['text'] } })
  async speak(@Body() body: { text?: unknown }, @Res() res: Response) {
    await this.respondAudio(typeof body?.text === 'string' ? body.text : '', res);
  }

  /** Variante GET pour les lecteurs audio qui n'acceptent qu'une URL (application mobile). */
  @Get('tts')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Synthèse vocale wolof par URL : ?text=… → audio WAV' })
  @ApiQuery({ name: 'text', required: true })
  async speakGet(@Query('text') text: string | undefined, @Res() res: Response) {
    await this.respondAudio(text ?? '', res);
  }

  private async respondAudio(raw: string, res: Response): Promise<void> {
    if (!this.tts.available) throw new ServiceUnavailableException('Voix wolof non activée (SAMASTAT_WOLOF_TTS=1).');
    const text = raw.trim();
    if (text.length < 2) throw new BadRequestException('Texte vide.');
    const wav = await this.tts.synthesize(text);
    if (!wav) throw new ServiceUnavailableException('Synthèse vocale indisponible.');
    res.status(200).setHeader('Content-Type', 'audio/wav').setHeader('Cache-Control', 'private, max-age=3600').send(wav);
  }
}

function mapTranscriptionError(err: unknown): never {
  if (err instanceof TranscriptionError) {
    if (err.kind === 'missing' || err.kind === 'format') throw new BadRequestException(err.message);
    if (err.kind === 'quota') throw new ServiceUnavailableException(err.message);
    throw new ServiceUnavailableException(err.message);
  }
  throw err;
}
