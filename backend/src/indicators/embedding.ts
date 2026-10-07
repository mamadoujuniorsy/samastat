import path from 'node:path';
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

/**
 * Embeddings calculés localement avec transformers.js (ONNX), sans service externe.
 * Le modèle e5 attend un préfixe « query: » pour les questions et « passage: » pour les documents.
 */
export const DEFAULT_EMBEDDING_MODEL = 'Xenova/multilingual-e5-small';
export const EMBEDDING_DIMS = 384;

export interface Embedder {
  readonly model: string;
  embedQuery(text: string): Promise<number[]>;
  embedPassages(texts: string[]): Promise<number[][]>;
}

export interface EmbeddableIndicator {
  name: string;
  territory: string;
  period: string;
  description: string | null;
  keywords: string[];
  unit?: string;
}

/** Texte indexé pour un indicateur : nom, territoire, période, description, mots-clés. */
export function passageText(i: EmbeddableIndicator): string {
  return [i.name, i.territory, i.period, i.description ?? '', i.keywords.join(', ')]
    .filter(Boolean)
    .join('. ');
}

export interface EmbeddableSurvey {
  title: string;
  abstract: string | null;
  keywords: string[];
  year_start: number | null;
  year_end: number | null;
}

/** Texte indexé pour une étude ANADS : titre, années, mots-clés, début du résumé. */
export function surveyPassageText(s: EmbeddableSurvey): string {
  const years = [s.year_start, s.year_end].filter((y): y is number => y != null);
  return [s.title, years.length ? `${years[0]}${years[1] && years[1] !== years[0] ? `-${years[1]}` : ''}` : '', s.keywords.join(', '), (s.abstract ?? '').slice(0, 500)]
    .filter(Boolean)
    .join('. ');
}

/** Représentation textuelle acceptée par pgvector : « [0.1,0.2,...] ». */
export function toVectorLiteral(v: number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(',')}]`;
}

export function modelsDir(): string {
  return process.env.SAMASTAT_MODELS_DIR ?? path.resolve(process.cwd(), '.models');
}

export async function createEmbedder(
  model = process.env.SAMASTAT_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
): Promise<Embedder> {
  const extractor: FeatureExtractionPipeline = await pipeline('feature-extraction', model, {
    cache_dir: modelsDir(),
    dtype: 'fp32',
  });

  async function embed(texts: string[]): Promise<number[][]> {
    const out = await extractor(texts, { pooling: 'mean', normalize: true });
    return out.tolist() as number[][];
  }

  return {
    model,
    async embedQuery(text) {
      const [v] = await embed([`query: ${text}`]);
      return v;
    },
    embedPassages(texts) {
      return embed(texts.map((t) => `passage: ${t}`));
    },
  };
}
