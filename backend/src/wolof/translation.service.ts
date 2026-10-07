import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pipeline, type TranslationPipeline } from '@huggingface/transformers';
import { modelsDir } from '../indicators/embedding.js';
import { protect, restore } from './sentinels.js';

/**
 * Traduction wolof ↔ français en local (NLLB-200 distillé 600M, port ONNX, transformers.js).
 * Activée par SAMASTAT_WOLOF_TRANSLATION=1 (téléchargement d'environ 1 Go au premier usage).
 * Licence du modèle : CC BY-NC 4.0 (usage non commercial) — voir docs/wolof.md.
 *
 * Les valeurs chiffrées ne passent JAMAIS par le traducteur : elles sont remplacées par des
 * jetons de substitution (X1, X2…) avant traduction, puis réinsérées ; si un jeton manque ou est
 * dupliqué à l'arrivée, la traduction est rejetée.
 */
export const TRANSLATION_MODEL = 'Xenova/nllb-200-distilled-600M';

@Injectable()
export class TranslationService implements OnModuleInit {
  private readonly logger = new Logger(TranslationService.name);
  private readonly enabled: boolean;
  private translator: Promise<TranslationPipeline | null> | null = null;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('SAMASTAT_WOLOF_TRANSLATION') === '1';
  }

  onModuleInit(): void {
    if (this.enabled) void this.get();
    else this.logger.log('Traduction wolof inactive (SAMASTAT_WOLOF_TRANSLATION≠1) : le modèle répond lui-même en wolof.');
  }

  get available(): boolean {
    return this.enabled;
  }

  private get(): Promise<TranslationPipeline | null> {
    if (!this.enabled) return Promise.resolve(null);
    if (!this.translator) {
      const started = Date.now();
      this.translator = pipeline('translation', TRANSLATION_MODEL, { cache_dir: modelsDir(), dtype: 'q8' })
        .then((p) => {
          this.logger.log(`Traducteur wolof prêt (${TRANSLATION_MODEL}) en ${Date.now() - started} ms`);
          return p as TranslationPipeline;
        })
        .catch((err: Error) => {
          this.logger.warn(`Traducteur wolof indisponible : ${err.message}`);
          this.translator = null;
          return null;
        });
    }
    return this.translator;
  }

  private async translate(text: string, src: 'wol_Latn' | 'fra_Latn', tgt: 'wol_Latn' | 'fra_Latn'): Promise<string | null> {
    const t = await this.get();
    if (!t) return null;
    try {
      const out = await t(text, { src_lang: src, tgt_lang: tgt, max_new_tokens: 120 } as never);
      const first = Array.isArray(out) ? out[0] : out;
      const translated = (first as { translation_text?: string }).translation_text?.trim();
      return translated || null;
    } catch (err) {
      this.logger.warn(`Traduction en échec : ${(err as Error).message}`);
      return null;
    }
  }

  /** Question wolof → français, pour aider la recherche et la compréhension. */
  toFrench(text: string): Promise<string | null> {
    return this.translate(text, 'wol_Latn', 'fra_Latn');
  }

  /**
   * Rend en wolof un texte français contenant des segments protégés (valeurs, périodes, sources).
   * `protectedSegments` : les chaînes à ne pas traduire, dans l'ordre d'apparition dans `french`.
   * Renvoie null si la traduction altère les jetons.
   */
  async renderWolof(french: string, protectedSegments: string[]): Promise<string | null> {
    const translated = await this.translate(protect(french, protectedSegments), 'fra_Latn', 'wol_Latn');
    if (!translated) return null;
    const restored = restore(translated, protectedSegments);
    if (!restored) this.logger.warn(`Traduction wolof rejetée : jetons altérés dans « ${translated} »`);
    return restored;
  }
}
