import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type Job } from 'bullmq';
import { EmbeddingsService } from '../indicators/embeddings.service.js';
import { IndicatorsRepository } from '../indicators/indicators.repository.js';
import { SurveysRepository } from '../indicators/surveys.repository.js';
import { passageText, surveyPassageText } from '../indicators/embedding.js';

export interface ReindexJob {
  all: boolean;
  reason: string;
}

export interface IndexingStatus {
  queue: 'redis' | 'in-process';
  indicators: number;
  indexed: number;
  surveys: number;
  surveysIndexed: number;
  running: boolean;
  lastRun: { startedAt: string; finishedAt: string | null; processed: number; error: string | null } | null;
}

const QUEUE_NAME = 'samastat-indexing';
const BATCH = 16;

/**
 * Indexation sémantique en tâche de fond (Jalon 2/3). File BullMQ sur Redis quand il est
 * disponible, sinon exécution directe en processus : le comportement fonctionnel est le même.
 * Au démarrage, les indicateurs non indexés sont mis en file automatiquement.
 */
@Injectable()
export class IndexingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexingService.name);
  private queue: Queue<ReindexJob> | null = null;
  private worker: Worker<ReindexJob> | null = null;
  private running = false;
  private lastRun: IndexingStatus['lastRun'] = null;

  constructor(
    private readonly config: ConfigService,
    private readonly embeddings: EmbeddingsService,
    private readonly indicators: IndicatorsRepository,
    private readonly surveys: SurveysRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL');
    if (url) {
      try {
        const connection = parseRedisUrl(url);
        this.queue = new Queue<ReindexJob>(QUEUE_NAME, { connection });
        this.worker = new Worker<ReindexJob>(QUEUE_NAME, (job) => this.process(job.data), {
          connection,
          concurrency: 1,
        });
        this.worker.on('failed', (job, err) => this.logger.warn(`Job ${job?.id} en échec : ${err.message}`));
        this.worker.on('error', (err) => this.logger.warn(`File d'indexation : ${err.message}`));
        this.logger.log('File d’indexation BullMQ prête');
      } catch (err) {
        this.logger.warn(`BullMQ indisponible, indexation en processus : ${(err as Error).message}`);
        this.queue = null;
        this.worker = null;
      }
    }
    // Auto-réparation : tout indicateur non indexé au démarrage est traité en arrière-plan.
    void this.enqueue({ all: false, reason: 'démarrage' });
  }

  async enqueue(job: ReindexJob): Promise<{ queued: boolean; mode: IndexingStatus['queue'] }> {
    if (this.queue) {
      try {
        await this.queue.add('reindex', job, { removeOnComplete: 20, removeOnFail: 20 });
        return { queued: true, mode: 'redis' };
      } catch (err) {
        this.logger.warn(`Ajout en file impossible, exécution directe : ${(err as Error).message}`);
      }
    }
    void this.process(job).catch((err: Error) => this.logger.warn(`Indexation en échec : ${err.message}`));
    return { queued: true, mode: 'in-process' };
  }

  async status(): Promise<IndexingStatus> {
    const [indicators, indexed, surveys] = await Promise.all([
      this.indicators.count(),
      this.indicators.countIndexed(),
      this.surveys.count(),
    ]);
    return {
      queue: this.queue ? 'redis' : 'in-process',
      indicators,
      indexed,
      surveys: surveys.total,
      surveysIndexed: surveys.indexed,
      running: this.running,
      lastRun: this.lastRun,
    };
  }

  private async process(job: ReindexJob | Job<ReindexJob>['data']): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    const run = { startedAt: new Date().toISOString(), finishedAt: null as string | null, processed: 0, error: null as string | null };
    this.lastRun = run;
    try {
      const embedder = await this.embeddings.get();
      if (!embedder) throw new Error("modèle d'embeddings indisponible");
      const pending = await this.indicators.findUnindexed(embedder.model, job.all);
      for (let i = 0; i < pending.length; i += BATCH) {
        const batch = pending.slice(i, i + BATCH);
        const vectors = await embedder.embedPassages(batch.map(passageText));
        for (let j = 0; j < batch.length; j++) {
          await this.indicators.setEmbedding(batch[j].id, vectors[j], embedder.model);
          run.processed++;
        }
      }
      const pendingSurveys = await this.surveys.findUnindexed(embedder.model, job.all);
      for (let i = 0; i < pendingSurveys.length; i += BATCH) {
        const batch = pendingSurveys.slice(i, i + BATCH);
        const vectors = await embedder.embedPassages(batch.map(surveyPassageText));
        for (let j = 0; j < batch.length; j++) {
          await this.surveys.setEmbedding(batch[j].idno, vectors[j], embedder.model);
          run.processed++;
        }
      }
      if (run.processed) this.logger.log(`${run.processed} indicateur(s) indexé(s) (${job.reason})`);
      return run.processed;
    } catch (err) {
      run.error = (err as Error).message;
      throw err;
    } finally {
      run.finishedAt = new Date().toISOString();
      this.running = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
  }
}

function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number } {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
  };
}
