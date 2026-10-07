import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { EmbeddingsService } from './embeddings.service.js';
import { toVectorLiteral } from './embedding.js';

/** Une étude du catalogue ANADS (métadonnées uniquement, jamais de microdonnées). */
export interface Survey {
  idno: string;
  nada_id: number;
  title: string;
  year_start: number | null;
  year_end: number | null;
  authoring_entity: string | null;
  abstract: string | null;
  keywords: string[];
  url: string;
  score?: number;
}

const COLUMNS = 'idno, nada_id, title, year_start, year_end, authoring_entity, abstract, keywords, url';

@Injectable()
export class SurveysRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Recherche hybride dans le catalogue ANADS (vectorielle + plein texte), résumé tronqué. */
  async search(query: string, limit = 6): Promise<Survey[]> {
    const q = query.trim();
    if (!q) return [];
    const vector = await this.embeddings.embedQuery(q);
    const res = vector
      ? await this.db.query<Survey>(
          `SELECT ${COLUMNS},
                  round((0.7 * coalesce(1 - (embedding <=> $1::vector), 0) +
                         0.3 * least(ts_rank(search_document, plainto_tsquery('french', $2)), 1))::numeric, 3) AS score
             FROM surveys ORDER BY score DESC, year_start DESC NULLS LAST LIMIT $3`,
          [toVectorLiteral(vector), q, limit],
        )
      : await this.db.query<Survey>(
          `SELECT ${COLUMNS}, round(least(ts_rank(search_document, plainto_tsquery('french', $1)), 1)::numeric, 3) AS score
             FROM surveys WHERE search_document @@ plainto_tsquery('french', $1)
            ORDER BY score DESC, year_start DESC NULLS LAST LIMIT $2`,
          [q, limit],
        );
    return res.rows.map((s) => ({ ...s, abstract: s.abstract ? `${s.abstract.slice(0, 300)}${s.abstract.length > 300 ? '…' : ''}` : null }));
  }

  async getByIdnos(idnos: string[]): Promise<Survey[]> {
    if (!idnos.length) return [];
    const res = await this.db.query<Survey>(`SELECT ${COLUMNS} FROM surveys WHERE idno = ANY($1::text[])`, [idnos]);
    return res.rows;
  }

  async count(): Promise<{ total: number; indexed: number }> {
    const res = await this.db.query<{ total: string; indexed: string }>(
      'SELECT count(*)::text AS total, count(embedding)::text AS indexed FROM surveys',
    );
    return { total: Number(res.rows[0]?.total ?? 0), indexed: Number(res.rows[0]?.indexed ?? 0) };
  }

  async findUnindexed(model: string, all = false): Promise<Survey[]> {
    const res = await this.db.query<Survey>(
      `SELECT ${COLUMNS} FROM surveys
        WHERE $1::boolean OR embedding IS NULL OR embedding_model IS DISTINCT FROM $2 ORDER BY idno`,
      [all, model],
    );
    return res.rows;
  }

  async setEmbedding(idno: string, vector: number[], model: string): Promise<void> {
    await this.db.query('UPDATE surveys SET embedding = $1::vector, embedding_model = $2 WHERE idno = $3', [
      toVectorLiteral(vector),
      model,
      idno,
    ]);
  }
}
