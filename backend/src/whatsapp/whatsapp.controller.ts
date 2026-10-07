import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WhatsappService } from './whatsapp.service.js';

/** Forme minimale du webhook Meta : texte et vocaux. */
interface IncomingMessage {
  from?: string;
  type?: string;
  text?: { body?: string };
  audio?: { id?: string; mime_type?: string; voice?: boolean };
  voice?: { id?: string; mime_type?: string };
}

interface WebhookPayload {
  object?: string;
  entry?: {
    changes?: {
      value?: {
        messages?: IncomingMessage[];
      };
    }[];
  }[];
}

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  /** Vérification du webhook par Meta (hub.mode / hub.verify_token / hub.challenge). */
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
  ): string {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN')?.trim();
    if (!expected || mode !== 'subscribe' || token !== expected) {
      throw new ForbiddenException('Jeton de vérification invalide.');
    }
    return challenge ?? '';
  }

  /** Réception des messages. Répond 200 immédiatement, traite en arrière-plan. */
  @Post('webhook')
  @HttpCode(200)
  receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: WebhookPayload,
  ): { received: true } {
    if (!this.whatsapp.enabled) throw new ServiceUnavailableException('Canal WhatsApp non configuré.');
    if (!this.whatsapp.verifySignature(req.rawBody, signature)) {
      throw new ForbiddenException('Signature invalide.');
    }
    if (body?.object !== 'whatsapp_business_account') return { received: true };

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          if (!msg.from) continue;
          const from = msg.from;
          if (msg.type === 'text' && msg.text?.body) {
            const text = msg.text.body.trim().slice(0, 500);
            if (text.length < 2) continue;
            void this.whatsapp
              .handleIncomingText(from, text)
              .catch((err: Error) => this.logger.warn(`Traitement WhatsApp en échec : ${err.message}`));
            continue;
          }
          const voice = incomingVoice(msg);
          if (voice) {
            void this.whatsapp
              .handleIncomingAudio(from, voice.id, voice.mimeType)
              .catch((err: Error) => this.logger.warn(`Traitement vocal WhatsApp en échec : ${err.message}`));
            continue;
          }
          if (msg.type && msg.type !== 'system' && msg.type !== 'reaction') {
            void this.whatsapp.sendUnsupportedHint(from).catch((err: Error) => this.logger.warn(err.message));
          }
        }
      }
    }
    return { received: true };
  }
}

function incomingVoice(msg: IncomingMessage): { id: string; mimeType: string | undefined } | null {
  if ((msg.type === 'audio' || msg.type === 'voice') && msg.audio?.id) {
    return { id: msg.audio.id, mimeType: msg.audio.mime_type };
  }
  if (msg.type === 'voice' && msg.voice?.id) {
    return { id: msg.voice.id, mimeType: msg.voice.mime_type };
  }
  return null;
}
