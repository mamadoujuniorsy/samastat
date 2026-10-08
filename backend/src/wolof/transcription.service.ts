import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { detectLanguage } from '../assistant/wolof.js';

export type VoiceLanguage = 'fr' | 'wo' | 'auto';

export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly kind: 'missing' | 'format' | 'unavailable' | 'failed' | 'quota',
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

export const AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/opus',
  'application/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/aac',
  'audio/amr',
  'audio/3gpp',
  'audio/3gpp2',
] as const;

const WOLOF_PROMPT =
  'Transcrire fidèlement en wolof parlé au Sénégal (alphabet latin avec lettres ñ, ë, ó, à), sans traduire en français. Questions statistiques ANSD, RGPH-5, démographie, population, économie. Exemples : Ñaata nit ñoo dëkk Dakar ? Askanu Senegaal ñaata la tollu ? Lan mooy taux de chômage bi ? Négég, liggéey, ndóol, diiwaan, Ndakaaru, Thiès, Diourbel, Fatick, Kaolack, Kolda, Louga, Matam, Saint-Louis, Sédhiou, Tambacounda, Kédougou, Ziguinchor.';
const FRENCH_PROMPT =
  'Question statistique sur le Sénégal. Transcrire fidèlement en français. ANSD, RGPH-5, EHCVM, ENES, IHPC, Dakar, Thiès, Diourbel, Saint-Louis, Ziguinchor, population, taux de chômage, inflation, pauvreté, espérance de vie.';
const AUTO_PROMPT =
  'Question statistique posée au Sénégal, en wolof ou en français. Transcrire fidèlement la langue parlée (alphabet latin), sans traduire. Mots-clés : ANSD, RGPH, Dakar, Ndakaaru, Thiès, askan, nit, ñaata, liggéey, chômage, population, inflation, njëg, diiwaan.';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private readonly config: ConfigService) {}

  get available(): boolean {
    return Boolean(this.localAsrUrl || this.apiKey);
  }

  get localAvailable(): boolean {
    return Boolean(this.localAsrUrl);
  }

  get provider(): 'groq' | 'local-kiriku' | 'none' {
    if (this.apiKey && this.wolofProvider !== 'local') return 'groq';
    if (this.localAsrUrl) return 'local-kiriku';
    return 'none';
  }

  async transcribe(
    file: { buffer: Buffer; mimetype: string; originalname?: string } | undefined,
    language: VoiceLanguage | string | undefined,
  ): Promise<{ text: string; language: 'fr' | 'wo' }> {
    if (!file?.buffer?.length) throw new TranscriptionError('Enregistrement audio manquant.', 'missing');
    let mime = normalizeAudioMime(file.mimetype);
    if (!isAcceptedAudioMime(mime) && (mime.startsWith('audio/') || mime === 'application/octet-stream' || !mime)) {
      mime = 'audio/ogg';
    }
    if (!isAcceptedAudioMime(mime)) {
      throw new TranscriptionError('Format audio non pris en charge.', 'format');
    }
    const hint = parseVoiceLanguage(language);
    const localUrl = this.localAsrUrl;
    if (localUrl && hint === 'wo' && this.wolofProvider === 'local') {
      return this.transcribeLocal(file, mime, localUrl);
    }

    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new TranscriptionError('La transcription locale Wolof est indisponible et aucune clé Groq de secours n’est configurée.', 'unavailable');
    }
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: mime }),
      safeAudioFilename(file.originalname ?? 'vocal', mime),
    );
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');
    const fields = whisperLanguageFields(hint);
    if (fields.language) form.append('language', fields.language);
    form.append('prompt', fields.prompt);

    let upstream: globalThis.Response;
    try {
      upstream = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      throw new TranscriptionError('Le service de transcription est temporairement injoignable.', 'unavailable');
    }

    const result = (await upstream.json().catch(() => null)) as {
      text?: unknown;
      language?: unknown;
      error?: { message?: string };
    } | null;
    if (upstream.status === 429) {
      throw new TranscriptionError('Limite de transcription atteinte. Réessayez dans un instant.', 'quota');
    }
    if (!upstream.ok || typeof result?.text !== 'string') {
      this.logger.warn(`Transcription Groq refusée (${upstream.status}) : ${result?.error?.message ?? ''}`.trim());
      throw new TranscriptionError('La transcription a échoué. Réessayez ou saisissez votre question.', 'failed');
    }

    const text = result.text.trim();
    if (text.length < 2) {
      throw new TranscriptionError('Aucune parole reconnue. Réessayez plus près du micro.', 'failed');
    }

    return {
      text,
      language: resolveTranscriptLanguage(hint, text, typeof result.language === 'string' ? result.language : undefined),
    };
  }

  private get apiKey(): string | undefined {
    return groqTranscriptionKey((key) => this.config.get<string>(key));
  }

  private get localAsrUrl(): string | undefined {
    return this.config.get<string>('SAMASTAT_LOCAL_ASR_URL')?.trim() || undefined;
  }

  private get wolofProvider(): 'groq' | 'local' {
    return this.config.get<string>('SAMASTAT_WOLOF_ASR_PROVIDER')?.trim().toLowerCase() === 'local' ? 'local' : 'groq';
  }

  private async transcribeLocal(
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    mime: string,
    baseUrl: string,
  ): Promise<{ text: string; language: 'fr' | 'wo' }> {
    const form = new FormData();
    form.append(
      'audio',
      new Blob([new Uint8Array(file.buffer)], { type: mime }),
      safeAudioFilename(file.originalname ?? 'vocal', mime),
    );
    let response: globalThis.Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/transcribe`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(90_000),
      });
    } catch {
      throw new TranscriptionError('Le moteur local de transcription Wolof est injoignable.', 'unavailable');
    }
    const result = (await response.json().catch(() => null)) as { text?: unknown; detail?: string } | null;
    if (!response.ok || typeof result?.text !== 'string') {
      this.logger.warn(`ASR local refusé (${response.status}) : ${result?.detail ?? ''}`.trim());
      throw new TranscriptionError('La transcription locale Wolof a échoué.', 'failed');
    }
    const text = result.text.trim();
    if (text.length < 2) throw new TranscriptionError('Aucune parole Wolof reconnue.', 'failed');
    return { text, language: 'wo' };
  }
}

export function parseVoiceLanguage(raw: string | undefined): VoiceLanguage {
  if (raw === 'wo' || raw === 'fr' || raw === 'auto') return raw;
  return 'auto';
}

/** Clé Groq pour Whisper : GROQ_API_KEY, ou repli Groq si c’est bien le fournisseur de secours. */
export function groqTranscriptionKey(get: (key: string) => string | undefined): string | undefined {
  const direct = get('GROQ_API_KEY')?.trim();
  if (direct) return direct;
  const provider = get('SAMASTAT_FALLBACK_PROVIDER')?.trim() || 'groq';
  if (provider !== 'groq') return undefined;
  return get('SAMASTAT_FALLBACK_API_KEY')?.trim() || undefined;
}

export function resolveTranscriptLanguage(
  hint: VoiceLanguage,
  text: string,
  whisperLanguage?: string,
): 'fr' | 'wo' {
  if (hint === 'wo' || hint === 'fr') return hint;
  const detected = detectLanguage(text);
  if (detected === 'wo' || detected === 'fr') return detected;
  const w = (whisperLanguage ?? '').toLowerCase();
  if (w.startsWith('wo') || w.includes('wolof')) return 'wo';
  return 'fr';
}

export function normalizeAudioMime(mimetype: string): string {
  const mime = mimetype.split(';', 1)[0].trim().toLowerCase();
  if (mime === 'audio/wave' || mime === 'audio/x-wav') return 'audio/wav';
  if (mime === 'audio/mp3') return 'audio/mpeg';
  if (mime === 'audio/m4a' || mime === 'audio/x-m4a') return 'audio/mp4';
  return mime;
}

export function isAcceptedAudioMime(mime: string): boolean {
  return (AUDIO_MIME_TYPES as readonly string[]).includes(normalizeAudioMime(mime));
}

export function whisperLanguageFields(language: VoiceLanguage): { language?: 'fr'; prompt: string } {
  if (language === 'fr') return { language: 'fr', prompt: FRENCH_PROMPT };
  if (language === 'wo') return { prompt: WOLOF_PROMPT };
  return { prompt: AUTO_PROMPT };
}

export function safeAudioFilename(originalname: string, mimetype: string): string {
  const mime = normalizeAudioMime(mimetype);
  const extension =
    mime.includes('webm') ? 'webm'
    : mime.includes('ogg') || mime.includes('opus') ? 'ogg'
    : mime.includes('wav') ? 'wav'
    : mime.includes('mpeg') ? 'mp3'
    : mime.includes('amr') ? 'amr'
    : mime.includes('3gpp') ? '3gp'
    : mime.includes('aac') ? 'aac'
    : 'm4a';
  const base = originalname.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'question';
  return `${base}.${extension}`;
}
