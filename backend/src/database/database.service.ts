import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

/**
 * Accès PostgreSQL minimal : un pool partagé et une méthode `query`.
 * Volontairement sans ORM pour garder chaque requête lisible et auditable.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: pg.Pool;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL manquant (voir .env.example)');
    }
    // numeric -> number : les valeurs restent des nombres côté API.
    pg.types.setTypeParser(1700, (v) => Number(v));
    this.pool = new pg.Pool({ connectionString, max: 10 });
    this.pool.on('error', (err) =>
      this.logger.error('Erreur pool PostgreSQL', err),
    );
  }

  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
