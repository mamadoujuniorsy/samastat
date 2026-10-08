import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pipeline, type TextToAudioPipeline } from '@huggingface/transformers';
import { modelsDir } from '../indicators/embedding.js';
import { encodeWav } from './wav.js';

/**
 * Synthèse vocale wolof en local (VITS MMS adapté au wolof, port ONNX, ~40-115 Mo).
 * Activée par SAMASTAT_WOLOF_TTS=1. Qualité expérimentale : point de contrôle « proxy » entraîné sur
 * WaxalNLP, licence CC BY-NC 4.0 — voir docs/wolof.md. Les réponses sont bornées à 400 caractères.
 */
export const WOLOF_TTS_MODEL = 'jaguaman09/mms-tts-wol-onnx';
export const SOYNADE_TTS_MODEL = 'oolel-voices';
const MAX_CHARS = 400;

export function prepareWolofTtsText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/%/g, ' pour cent ')
    .replace(/[“”"()[\]{}:;!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fr-FR')
    .slice(0, MAX_CHARS);
}

@Injectable()
export class WolofTtsService implements OnModuleInit {
  private readonly logger = new Logger(WolofTtsService.name);
  private readonly enabled: boolean;
  private readonly soynadeKey: string | undefined;
  private readonly soynadeUrl: string;
  private readonly allowLocalFallback: boolean;
  private tts: Promise<TextToAudioPipeline | null> | null = null;
  private readonly cache = new Map<string, Buffer>();

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('SAMASTAT_WOLOF_TTS') === '1';
    this.soynadeKey = config.get<string>('SOYNADE_API_KEY')?.trim() || undefined;
    this.soynadeUrl = config.get<string>('SOYNADE_TTS_URL')?.trim() || 'https://api.soynade.ai/v1/text-to-speech';
    this.allowLocalFallback = config.get<string>('SOYNADE_TTS_FALLBACK_LOCAL') === '1';
  }

  onModuleInit(): void {
    if (this.enabled) void this.get();
    else this.logger.log('Voix wolof inactive (SAMASTAT_WOLOF_TTS≠1).');
  }

  get available(): boolean {
    return this.enabled || Boolean(this.soynadeKey);
  }

  get provider(): 'soynade' | 'local' | 'none' {
    if (this.soynadeKey) return 'soynade';
    if (this.enabled) return 'local';
    return 'none';
  }

  get fallbackLocal(): boolean {
    return this.allowLocalFallback;
  }

  private async synthesizeSoynade(text: string): Promise<Buffer | null> {
    if (!this.soynadeKey) return null;
    try {
      const response = await fetch(this.soynadeUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.soynadeKey}`,
          'content-type': 'application/json',
          accept: 'audio/wav',
        },
        body: JSON.stringify({
          text,
          output_format: 'wav',
          exaggeration: 0.2,
          temperature: 0.2,
          cfg_weight: 0.5,
          seed: 0,
        }),
      });
      if (!response.ok) {
        this.logger.warn(`Soynade TTS indisponible (HTTP ${response.status}); repli local activé.`);
        return null;
      }
      const bytes = await response.arrayBuffer();
      return Buffer.from(bytes);
    } catch (err) {
      this.logger.warn(`Soynade TTS inaccessible; repli local activé : ${(err as Error).message}`);
      return null;
    }
  }

  private get(): Promise<TextToAudioPipeline | null> {
    if (!this.enabled) return Promise.resolve(null);
    if (!this.tts) {
      const started = Date.now();
      this.tts = pipeline('text-to-speech', WOLOF_TTS_MODEL, { cache_dir: modelsDir(), dtype: 'fp32' })
        .then((p) => {
          this.logger.log(`Voix wolof prête (${WOLOF_TTS_MODEL}) en ${Date.now() - started} ms`);
          return p as TextToAudioPipeline;
        })
        .catch((err: Error) => {
          this.logger.warn(`Voix wolof indisponible : ${err.message}`);
          this.tts = null;
          return null;
        });
    }
    return this.tts;
  }

  /** Texte wolof → WAV 16 bits mono ; null si le service est inactif ou en échec. */
  async synthesize(text: string): Promise<Buffer | null> {
    const clean = prepareWolofTtsText(text);
    if (!clean) return null;
    const hit = this.cache.get(clean);
    if (hit) return hit;
    const remote = await this.synthesizeSoynade(clean);
    if (remote) {
      if (this.cache.size > 200) this.cache.clear();
      this.cache.set(clean, remote);
      return remote;
    }
    // Do not silently return the experimental voice when a configured remote
    // provider fails; that produces a misleadingly poor audio response.
    if (!this.enabled || (this.soynadeKey && !this.allowLocalFallback)) return null;
    const t = await this.get();
    if (!t) return null;
    try {
      const out = await t(clean);
      const audio = Array.isArray(out.audio) ? out.audio[0] : out.audio;
      const wav = encodeWav(audio, out.sampling_rate);
      if (this.cache.size > 200) this.cache.clear();
      this.cache.set(clean, wav);
      return wav;
    } catch (err) {
      this.logger.warn(`Synthèse vocale en échec : ${(err as Error).message}`);
      return null;
    }
  }
}
