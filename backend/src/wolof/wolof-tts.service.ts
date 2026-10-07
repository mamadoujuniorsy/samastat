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
const MAX_CHARS = 400;

@Injectable()
export class WolofTtsService implements OnModuleInit {
  private readonly logger = new Logger(WolofTtsService.name);
  private readonly enabled: boolean;
  private tts: Promise<TextToAudioPipeline | null> | null = null;
  private readonly cache = new Map<string, Buffer>();

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('SAMASTAT_WOLOF_TTS') === '1';
  }

  onModuleInit(): void {
    if (this.enabled) void this.get();
    else this.logger.log('Voix wolof inactive (SAMASTAT_WOLOF_TTS≠1).');
  }

  get available(): boolean {
    return this.enabled;
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
    const t = await this.get();
    if (!t) return null;
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
    if (!clean) return null;
    const hit = this.cache.get(clean);
    if (hit) return hit;
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
