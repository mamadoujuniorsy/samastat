import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { AskResponse } from './assistant.types.js';

/** Journal d'usage anonymisé : question, issue, indicateurs mobilisés. Aucune donnée personnelle. */
@Injectable()
export class UsageLogService {
  private readonly logger = new Logger(UsageLogService.name);

  constructor(private readonly db: DatabaseService) {}

  async record(res: AskResponse): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO question_log (question, status, indicator_ids, guard_result, model, latency_ms, language, cached, survey_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          res.question,
          res.status,
          res.data.map((d) => d.indicatorId),
          res.meta.guard,
          res.meta.model,
          res.meta.latencyMs,
          res.meta.language,
          res.meta.cached,
          res.surveys.map((s) => s.idno),
        ],
      );
    } catch (err) {
      this.logger.warn(`Journal d'usage indisponible : ${(err as Error).message}`);
    }
  }

  /** Liste des questions (anonymes) sur la période, pour export CSV. */
  async questions(days = 30, status?: string): Promise<{ day: string; status: string; language: string; question: string; indicatorIds: string[] }[]> {
    const res = await this.db.query<{ day: string; status: string; language: string | null; question: string; indicator_ids: string[] }>(
      `SELECT to_char(created_at, 'YYYY-MM-DD HH24:MI') AS day, status, language, question, indicator_ids
         FROM question_log
        WHERE created_at > now() - ($1 || ' days')::interval AND ($2::text IS NULL OR status = $2)
        ORDER BY created_at DESC LIMIT 5000`,
      [days, status && ['answered', 'no_data', 'conversation', 'error'].includes(status) ? status : null],
    );
    return res.rows.map((r) => ({ day: r.day, status: r.status, language: r.language ?? 'unknown', question: r.question, indicatorIds: r.indicator_ids }));
  }

  /** Agrégats pour le tableau de bord d'usage destiné à l'ANSD. Les questions restent anonymes. */
  async stats(days = 30): Promise<UsageStats> {
    const since = [days];
    const window = `created_at > now() - ($1 || ' days')::interval`;
    const [byStatus, perDay, unanswered, topIndicators, guard, byLanguage, byDomain, byTerritory, topQuestions] = await Promise.all([
      this.db.query<{ status: string; n: string }>(
        `SELECT status, count(*)::text AS n FROM question_log WHERE ${window} GROUP BY status`,
        since,
      ),
      this.db.query<{ day: string; n: string; answered: string }>(
        `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*)::text AS n,
                count(*) FILTER (WHERE status = 'answered')::text AS answered
           FROM question_log WHERE ${window} GROUP BY 1 ORDER BY 1`,
        since,
      ),
      this.db.query<{ question: string; n: string }>(
        `SELECT question, count(*)::text AS n FROM question_log
          WHERE status = 'no_data' AND ${window}
          GROUP BY question ORDER BY count(*) DESC, max(created_at) DESC LIMIT 20`,
        since,
      ),
      this.db.query<{ indicator_id: string; name: string | null; territory: string | null; n: string }>(
        `SELECT u.indicator_id, i.name, i.territory, count(*)::text AS n
           FROM question_log q, unnest(q.indicator_ids) AS u(indicator_id)
           LEFT JOIN indicators i ON i.id = u.indicator_id
          WHERE q.${window}
          GROUP BY 1, 2, 3 ORDER BY count(*) DESC LIMIT 20`,
        since,
      ),
      this.db.query<{ fallback: string; cached: string; avg_latency: string | null }>(
        `SELECT count(*) FILTER (WHERE guard_result = 'fallback')::text AS fallback,
                count(*) FILTER (WHERE cached)::text AS cached,
                round(avg(latency_ms) FILTER (WHERE NOT cached))::text AS avg_latency
           FROM question_log WHERE ${window}`,
        since,
      ),
      this.db.query<{ language: string | null; n: string }>(
        `SELECT coalesce(language, 'unknown') AS language, count(*)::text AS n
           FROM question_log WHERE ${window} GROUP BY 1 ORDER BY 2 DESC`,
        since,
      ),
      this.db.query<{ domain: string; n: string }>(
        `SELECT i.domain, count(DISTINCT q.id)::text AS n
           FROM question_log q, unnest(q.indicator_ids) AS u(indicator_id)
           JOIN indicators i ON i.id = u.indicator_id
          WHERE q.${window} GROUP BY 1 ORDER BY 2 DESC`,
        since,
      ),
      this.db.query<{ territory: string; territory_level: string; n: string }>(
        `SELECT i.territory, i.territory_level, count(DISTINCT q.id)::text AS n
           FROM question_log q, unnest(q.indicator_ids) AS u(indicator_id)
           JOIN indicators i ON i.id = u.indicator_id
          WHERE q.${window} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30`,
        since,
      ),
      this.db.query<{ question: string; status: string; n: string }>(
        `SELECT lower(trim(question)) AS question, mode() WITHIN GROUP (ORDER BY status) AS status, count(*)::text AS n
           FROM question_log WHERE ${window} AND status <> 'error'
          GROUP BY 1 ORDER BY count(*) DESC, max(created_at) DESC LIMIT 20`,
        since,
      ),
    ]);
    const total = byStatus.rows.reduce((s, r) => s + Number(r.n), 0);
    return {
      days,
      total,
      byStatus: Object.fromEntries(byStatus.rows.map((r) => [r.status, Number(r.n)])),
      byLanguage: Object.fromEntries(byLanguage.rows.map((r) => [r.language ?? 'unknown', Number(r.n)])),
      byDomain: byDomain.rows.map((r) => ({ domain: r.domain, count: Number(r.n) })),
      byTerritory: byTerritory.rows.map((r) => ({ territory: r.territory, level: r.territory_level, count: Number(r.n) })),
      perDay: perDay.rows.map((r) => ({ day: r.day, total: Number(r.n), answered: Number(r.answered) })),
      unansweredQuestions: unanswered.rows.map((r) => ({ question: r.question, count: Number(r.n) })),
      topQuestions: topQuestions.rows.map((r) => ({ question: r.question, status: r.status, count: Number(r.n) })),
      topIndicators: topIndicators.rows.map((r) => ({
        indicatorId: r.indicator_id,
        name: r.name,
        territory: r.territory,
        count: Number(r.n),
      })),
      guardFallbacks: Number(guard.rows[0]?.fallback ?? 0),
      cachedAnswers: Number(guard.rows[0]?.cached ?? 0),
      avgLatencyMs: guard.rows[0]?.avg_latency ? Number(guard.rows[0].avg_latency) : null,
    };
  }
}

export interface UsageStats {
  days: number;
  total: number;
  byStatus: Record<string, number>;
  byLanguage: Record<string, number>;
  byDomain: { domain: string; count: number }[];
  byTerritory: { territory: string; level: string; count: number }[];
  perDay: { day: string; total: number; answered: number }[];
  unansweredQuestions: { question: string; count: number }[];
  topQuestions: { question: string; status: string; count: number }[];
  topIndicators: { indicatorId: string; name: string | null; territory: string | null; count: number }[];
  guardFallbacks: number;
  cachedAnswers: number;
  avgLatencyMs: number | null;
}
