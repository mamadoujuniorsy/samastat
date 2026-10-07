import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantService } from '../assistant/assistant.service.js';
import type { AskResponse, HistoryTurn } from '../assistant/assistant.types.js';
import { TranscriptionError, TranscriptionService } from '../wolof/transcription.service.js';
import { WolofTtsService } from '../wolof/wolof-tts.service.js';

/**
 * Canal WhatsApp (Jalon 5) via l'API Cloud de Meta. Activé uniquement si
 * WHATSAPP_ACCESS_TOKEN et WHATSAPP_PHONE_NUMBER_ID sont configurés.
 * Le contexte de conversation par numéro est gardé en mémoire, borné, et le numéro
 * n'est jamais journalisé : seule la question passe au journal d'usage anonyme.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly accessToken: string | undefined;
  private readonly phoneNumberId: string | undefined;
  private readonly appSecret: string | undefined;
  private readonly apiVersion: string;
  private readonly history = new Map<string, { turns: HistoryTurn[]; updatedAt: number }>();

  constructor(
    config: ConfigService,
    private readonly assistant: AssistantService,
    private readonly transcription: TranscriptionService,
    private readonly tts?: WolofTtsService,
  ) {
    this.accessToken = config.get<string>('WHATSAPP_ACCESS_TOKEN')?.trim() || undefined;
    this.phoneNumberId = config.get<string>('WHATSAPP_PHONE_NUMBER_ID')?.trim() || undefined;
    this.appSecret = config.get<string>('WHATSAPP_APP_SECRET')?.trim() || undefined;
    this.apiVersion = config.get<string>('WHATSAPP_API_VERSION')?.trim() || 'v21.0';
    if (!this.enabled) this.logger.log('Canal WhatsApp inactif (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID absents).');
  }

  get enabled(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  /** Vérifie la signature X-Hub-Signature-256 si WHATSAPP_APP_SECRET est défini. */
  verifySignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
    if (!this.appSecret) return true;
    if (!rawBody || !signature?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', this.appSecret).update(rawBody).digest('hex');
    const given = signature.slice('sha256='.length);
    return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  }

  /** Traite un message texte entrant : question → réponse sourcée → envoi. */
  async handleIncomingText(
    from: string,
    text: string,
    opts: { fromAudio?: boolean; language?: 'fr' | 'wo' } = {},
  ): Promise<AskResponse> {
    const entry = this.history.get(from) ?? { turns: [], updatedAt: 0 };
    const response = await this.assistant.ask({ question: text, history: entry.turns, language: opts.language });
    if (response.status !== 'error') {
      const next: HistoryTurn[] = [...entry.turns, { role: 'user', text }, { role: 'assistant', text: response.answerWolof ?? response.answer }];
      entry.turns = next.slice(-8);
    }
    entry.updatedAt = Date.now();
    this.history.set(from, entry);
    this.pruneHistory();
    await this.sendText(from, formatForWhatsapp(response, opts.fromAudio ? text : undefined));
    if (opts.fromAudio) await this.maybeSendSpokenReply(from, response);
    return response;
  }

  async handleIncomingAudio(from: string, mediaId: string, mimeType: string | undefined): Promise<void> {
    await this.sendText(from, 'J’écoute votre vocal (wolof ou français)…');
    try {
      const file = await this.downloadMedia(mediaId, mimeType);
      const { text, language } = await this.transcription.transcribe(file, 'auto');
      await this.handleIncomingText(from, text.slice(0, 500), { fromAudio: true, language });
    } catch (err) {
      const message =
        err instanceof TranscriptionError
          ? err.kind === 'unavailable'
            ? 'La transcription des vocaux n’est pas disponible pour le moment. Envoyez votre question en texte.'
            : err.message
          : 'Je n’ai pas pu écouter ce vocal. Réessayez, ou envoyez un texte en wolof ou en français.';
      this.logger.warn(`Vocal WhatsApp en échec : ${(err as Error).message}`);
      await this.sendText(from, message);
    }
  }

  async sendUnsupportedHint(to: string): Promise<void> {
    await this.sendText(
      to,
      'SamaStat lit le texte et les vocaux, en wolof ou en français. Envoyez une question sur les statistiques du Sénégal.',
    );
  }

  async sendText(to: string, body: string): Promise<void> {
    if (!this.enabled) return;
    const res = await fetch(`https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: false } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      this.logger.warn(`Envoi WhatsApp refusé (${res.status}) : ${(await res.text()).slice(0, 200)}`);
    }
  }

  private async maybeSendSpokenReply(to: string, response: AskResponse): Promise<void> {
    const spoken = spokenReplyText(response);
    if (!spoken || !this.tts?.available) return;
    try {
      const wav = await this.tts.synthesize(spoken);
      if (!wav) return;
      const mediaId = await this.uploadAudio(wav);
      if (!mediaId) return;
      const res = await fetch(`https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'audio',
          audio: { id: mediaId },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) this.logger.warn(`Vocal WhatsApp refusé (${res.status})`);
    } catch (err) {
      this.logger.warn(`Vocal de réponse WhatsApp en échec : ${(err as Error).message}`);
    }
  }

  private async uploadAudio(wav: Buffer): Promise<string | null> {
    if (!this.accessToken || !this.phoneNumberId) return null;
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'audio/wav');
    // Node's Buffer may be backed by SharedArrayBuffer; copy to a plain ArrayBuffer for BlobPart.
    const audioBuffer = new ArrayBuffer(wav.byteLength);
    new Uint8Array(audioBuffer).set(wav);
    form.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'reponse.wav');
    const res = await fetch(`https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/media`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.accessToken}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    return res.ok && body?.id ? body.id : null;
  }

  private async downloadMedia(id: string, mimeType: string | undefined): Promise<{ buffer: Buffer; mimetype: string; originalname: string }> {
    if (!this.accessToken) throw new TranscriptionError('Canal WhatsApp non configuré.', 'unavailable');
    const metaRes = await fetch(`https://graph.facebook.com/${this.apiVersion}/${id}`, {
      headers: { authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    const meta = (await metaRes.json().catch(() => null)) as { url?: string; mime_type?: string } | null;
    if (!metaRes.ok || !meta?.url) {
      throw new TranscriptionError('Impossible de récupérer le vocal.', 'failed');
    }
    const bin = await fetch(meta.url, {
      headers: { authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!bin.ok) throw new TranscriptionError('Impossible de récupérer le vocal.', 'failed');
    const buffer = Buffer.from(await bin.arrayBuffer());
    if (buffer.length > 16 * 1024 * 1024) {
      throw new TranscriptionError('Vocal trop long. Posez une question plus courte.', 'format');
    }
    const mimetype = meta.mime_type ?? mimeType ?? 'audio/ogg';
    return { buffer, mimetype: mimetype.split(';', 1)[0].trim() || 'audio/ogg', originalname: 'vocal' };
  }

  private pruneHistory(): void {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [k, v] of this.history) if (v.updatedAt < cutoff) this.history.delete(k);
    if (this.history.size > 5000) {
      const oldest = [...this.history.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt).slice(0, 1000);
      for (const [k] of oldest) this.history.delete(k);
    }
  }
}

/** Texte WhatsApp : réponse (wolof d’abord si la question l’était), puis chaque valeur avec sa source. */
export function formatForWhatsapp(r: AskResponse, transcribed?: string): string {
  const lines: string[] = [];
  if (transcribed) {
    lines.push(`_Vocal compris : ${transcribed.slice(0, 280)}_`, '');
  }
  if (r.answerWolof && (r.meta.language === 'wo' || transcribed)) {
    lines.push(r.answerWolof);
    if (r.answer && r.answer !== r.answerWolof) lines.push('', r.answer);
  } else {
    lines.push(r.answer);
  }
  if (r.suggestions.length) {
    lines.push('', 'Vous pouvez essayer :', ...r.suggestions.map((s) => `• ${s}`));
  }
  if (r.data.length) {
    lines.push('');
    for (const d of r.data) {
      lines.push(`*${d.name}* — ${d.territory}, ${d.period} : ${d.formattedValue}`);
      lines.push(`Source : ${d.source}`, d.url);
    }
    lines.push('', 'Données ANSD (licence ouverte CC BY 4.0).');
  }
  return lines.join('\n').slice(0, 4000);
}

/** Texte lu à voix haute après un vocal : voix wolof locale uniquement (pas de TTS français). */
export function spokenReplyText(r: AskResponse): string | null {
  if (r.status === 'error') return null;
  if (r.answerWolof?.trim()) return r.answerWolof;
  if (r.meta.language === 'wo' && r.answer.trim()) return r.answer;
  return null;
}
