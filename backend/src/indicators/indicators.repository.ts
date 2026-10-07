import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { EmbeddingsService } from './embeddings.service.js';
import { toVectorLiteral } from './embedding.js';
import type { BrowseFilters, Indicator, IndicatorSummary, SearchFilters } from './indicator.types.js';

const FULL_COLUMNS = `id, name, description, value, unit, territory, territory_level,
              period, source, platform, url, keywords, domain, to_char(verified_at, 'YYYY-MM-DD') AS verified_at`;

const SUMMARY_COLUMNS = 'id, name, territory, territory_level, period, unit';

/** Clause de filtrage par métadonnées : $T = territoire, $P = période (NULL = pas de filtre). */
const FILTER_SQL = (t: string, p: string) =>
  `(${t}::text IS NULL OR unaccent(territory) ILIKE '%' || unaccent(${t}) || '%')
   AND (${p}::text IS NULL OR period ILIKE '%' || ${p} || '%')`;

@Injectable()
export class IndicatorsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /**
   * Recherche hybride : similarité vectorielle (70 %) + plein texte français (30 %),
   * filtrée par territoire et période. Sans embedding disponible, plein texte puis
   * correspondance partielle. Renvoie des résumés SANS valeur.
   */
  async search(query: string, filters: SearchFilters = {}, limit = 10): Promise<IndicatorSummary[]> {
    const q = query.trim();
    const territory = filters.territory?.trim() || null;
    const period = filters.period?.trim() || null;
    if (!q) return this.listAll(limit, filters);

    const vector = await this.embeddings.embedQuery(q);
    if (vector) {
      const res = await this.db.query<IndicatorSummary>(
        `SELECT ${SUMMARY_COLUMNS},
                round((
                  0.7 * coalesce(1 - (embedding <=> $1::vector), 0) +
                  0.3 * least(ts_rank(search_document, plainto_tsquery('french', $2)), 1)
                )::numeric, 3) AS score
           FROM indicators
          WHERE ${FILTER_SQL('$3', '$4')}
          ORDER BY score DESC, territory_level, territory
          LIMIT $5`,
        [toVectorLiteral(vector), q, territory, period, limit],
      );
      return res.rows;
    }

    const fts = await this.db.query<IndicatorSummary>(
      `SELECT ${SUMMARY_COLUMNS},
              round(least(ts_rank(search_document, plainto_tsquery('french', $1)), 1)::numeric, 3) AS score
         FROM indicators
        WHERE search_document @@ plainto_tsquery('french', $1)
          AND ${FILTER_SQL('$2', '$3')}
        ORDER BY score DESC, territory_level, territory
        LIMIT $4`,
      [q, territory, period, limit],
    );
    if (fts.rowCount) return fts.rows;

    const words = q
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3);
    if (!words.length) return [];
    const like = await this.db.query<IndicatorSummary>(
      `SELECT ${SUMMARY_COLUMNS}
         FROM indicators
        WHERE EXISTS (
          SELECT 1 FROM unnest($1::text[]) AS w
           WHERE name ILIKE '%' || w || '%'
              OR territory ILIKE '%' || w || '%'
              OR coalesce(description,'') ILIKE '%' || w || '%'
              OR array_to_string(keywords,' ') ILIKE '%' || w || '%')
          AND ${FILTER_SQL('$2', '$3')}
        ORDER BY territory_level, territory
        LIMIT $4`,
      [words, territory, period, limit],
    );
    return like.rows;
  }

  async listAll(limit = 50, filters: SearchFilters = {}): Promise<IndicatorSummary[]> {
    const res = await this.db.query<IndicatorSummary>(
      `SELECT ${SUMMARY_COLUMNS} FROM indicators
        WHERE ${FILTER_SQL('$2', '$3')}
        ORDER BY territory_level, territory, name LIMIT $1`,
      [limit, filters.territory?.trim() || null, filters.period?.trim() || null],
    );
    return res.rows;
  }

  async getByIds(ids: string[]): Promise<Indicator[]> {
    if (!ids.length) return [];
    const res = await this.db.query<Indicator>(
      `SELECT id, name, description, value, unit, territory, territory_level,
              period, source, platform, url, keywords, domain, to_char(verified_at, 'YYYY-MM-DD') AS verified_at
         FROM indicators WHERE id = ANY($1::text[])`,
      [ids],
    );
    return res.rows;
  }

  async getById(id: string): Promise<Indicator | null> {
    const res = await this.db.query<Indicator>(`SELECT ${FULL_COLUMNS} FROM indicators WHERE id = $1`, [id]);
    return res.rows[0] ?? null;
  }

  /** Enregistrements du même indicateur (nom + unité) : autres territoires et autres périodes. */
  async related(name: string, unit: string): Promise<Indicator[]> {
    const res = await this.db.query<Indicator>(
      `SELECT ${FULL_COLUMNS} FROM indicators WHERE name = $1 AND unit = $2
        ORDER BY territory_level, territory, period`,
      [name, unit],
    );
    return res.rows;
  }

  /** Navigation dans le catalogue complet (valeurs comprises : ce sont des données de la base). */
  async browse(filters: BrowseFilters = {}, limit = 500): Promise<Indicator[]> {
    const q = filters.q?.trim() || null;
    const res = await this.db.query<Indicator>(
      `SELECT ${FULL_COLUMNS} FROM indicators
        WHERE ($1::text IS NULL OR domain = $1)
          AND ($2::text IS NULL OR territory_level = $2)
          AND ($3::text IS NULL OR search_document @@ plainto_tsquery('french', $3)
               OR unaccent(name || ' ' || territory) ILIKE '%' || unaccent($3) || '%')
        ORDER BY domain, name, territory_level, territory, period
        LIMIT $4`,
      [filters.domain?.trim() || null, filters.level?.trim() || null, q, limit],
    );
    return res.rows;
  }

  async domains(): Promise<{ domain: string; count: number }[]> {
    const res = await this.db.query<{ domain: string; n: string }>(
      'SELECT domain, count(*)::text AS n FROM indicators GROUP BY domain ORDER BY count(*) DESC',
    );
    return res.rows.map((r) => ({ domain: r.domain, count: Number(r.n) }));
  }

  async count(): Promise<number> {
    const res = await this.db.query<{ n: string }>('SELECT count(*)::text AS n FROM indicators');
    return Number(res.rows[0]?.n ?? 0);
  }

  /** Indicateurs sans embedding, ou indexés avec un autre modèle. */
  async findUnindexed(model: string, all = false): Promise<Indicator[]> {
    const res = await this.db.query<Indicator>(
      `SELECT id, name, description, value, unit, territory, territory_level,
              period, source, platform, url, keywords, domain, to_char(verified_at, 'YYYY-MM-DD') AS verified_at
         FROM indicators
        WHERE $1::boolean OR embedding IS NULL OR embedding_model IS DISTINCT FROM $2
        ORDER BY id`,
      [all, model],
    );
    return res.rows;
  }

  async setEmbedding(id: string, vector: number[], model: string): Promise<void> {
    await this.db.query('UPDATE indicators SET embedding = $1::vector, embedding_model = $2 WHERE id = $3', [
      toVectorLiteral(vector),
      model,
      id,
    ]);
  }

  async countIndexed(): Promise<number> {
    const res = await this.db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM indicators WHERE embedding IS NOT NULL',
    );
    return Number(res.rows[0]?.n ?? 0);
  }
}
