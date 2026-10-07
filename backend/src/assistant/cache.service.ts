import { createHash } from 'node:crypto';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AskResponse } from './assistant.types.js';

const TTL_SECONDS = 6 * 60 * 60;

/**
 * Cache Redis des réponses aux questions sans contexte de conversation.
 * Objectif : ne pas rappeler le modèle pour une question déjà posée à l'identique.
 * Indisponible → on continue sans cache, jamais d'erreur pour l'utilisateur.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null;
  private healthy = true;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (!url) {
      this.redis = null;
      this.logger.warn('REDIS_URL absent : cache désactivé.');
      return;
    }
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 2000, 30_000),
    });
    this.redis.on('error', (err) => {
      if (this.healthy) this.logger.warn(`Redis indisponible, cache ignoré : ${err.message}`);
      this.healthy = false;
    });
    this.redis.on('ready', () => {
      this.healthy = true;
      this.logger.log('Cache Redis connecté');
    });
    this.redis.connect().catch(() => undefined);
  }

  static key(question: string): string {
    const normalized = question.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
    return `samastat:ask:v1:${createHash('sha1').update(normalized).digest('hex')}`;
  }

  async get(question: string): Promise<AskResponse | null> {
    if (!this.redis || !this.healthy) return null;
    try {
      const raw = await this.redis.get(CacheService.key(question));
      return raw ? (JSON.parse(raw) as AskResponse) : null;
    } catch {
      return null;
    }
  }

  async set(question: string, response: AskResponse): Promise<void> {
    if (!this.redis || !this.healthy) return;
    try {
      await this.redis.set(CacheService.key(question), JSON.stringify(response), 'EX', TTL_SECONDS);
    } catch {
      // le cache est un confort
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }
}
