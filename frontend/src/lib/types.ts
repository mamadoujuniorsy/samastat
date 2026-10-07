/** Miroir de la réponse de l'API backend (backend/src/assistant/assistant.types.ts). */

export type AnswerStatus = 'answered' | 'no_data' | 'conversation' | 'error';

export interface HistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface CitedRecord {
  indicatorId: string;
  name: string;
  value: number;
  formattedValue: string;
  unit: string;
  territory: string;
  territoryLevel: string;
  period: string;
  source: string;
  platform: string;
  url: string;
  domain: string;
  verifiedAt: string | null;
}

export interface CitedSurvey {
  idno: string;
  title: string;
  label: string;
  yearStart: number | null;
  yearEnd: number | null;
  authoringEntity: string | null;
  url: string;
}

export interface ChartPoint {
  label: string;
  value: number;
  formattedValue: string;
  indicatorId: string;
}

export interface ChartHint {
  kind: 'evolution' | 'comparison';
  title: string;
  unit: string;
  points: ChartPoint[];
}

export interface FollowUp {
  kind: 'compare' | 'evolution' | 'all_regions' | 'national';
  label: string;
  question: string;
}

export interface AskStep {
  kind: 'language' | 'translate' | 'fallback' | 'cache' | 'search' | 'fetch' | 'surveys' | 'no_data' | 'compose' | 'guard';
  label: string;
  detail?: string;
  at: string;
}

export interface AskResponse {
  status: AnswerStatus;
  question: string;
  answer: string;
  /** Version wolof (traduction locale, valeurs protégées) quand la question était en wolof. */
  answerWolof: string | null;
  suggestions: string[];
  data: CitedRecord[];
  surveys: CitedSurvey[];
  chart: ChartHint | null;
  followUps: FollowUp[];
  meta: {
    model: string;
    provider?: string;
    fallbackFrom?: string | null;
    retrievedAt: string;
    guard: 'passed' | 'fallback' | null;
    violations: string[];
    toolCalls: { tool: string; input: unknown; resultSummary: string }[];
    latencyMs: number;
    language: 'fr' | 'wo' | 'unknown';
    cached: boolean;
    permalink: string | null;
    attribution: string;
  };
}

export type AskEvent =
  | { type: 'step'; step: AskStep }
  | { type: 'answer'; response: AskResponse }
  | { type: 'error'; message: string };

export interface IndicatorSummary {
  id: string;
  name: string;
  territory: string;
  territory_level: string;
  period: string;
  unit: string;
}

/** Enregistrement complet tel que renvoyé par /catalogue et /indicators/:id. */
export interface IndicatorRecord {
  id: string;
  name: string;
  description: string | null;
  value: number;
  formattedValue: string;
  unit: string;
  territory: string;
  territory_level: string;
  period: string;
  source: string;
  platform: string;
  url: string;
  keywords: string[];
  domain: string;
  verified_at: string | null;
}

export interface IndicatorDetail {
  record: IndicatorRecord;
  byPeriod: IndicatorRecord[];
  byTerritory: IndicatorRecord[];
  evolution: ChartHint | null;
  comparison: ChartHint | null;
  citation: string;
}

export interface CatalogueResponse {
  domains: { domain: string; count: number }[];
  records: IndicatorRecord[];
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

/** Un échange dans le fil : la question posée, les étapes reçues, puis la réponse. */
export interface Exchange {
  id: string;
  question: string;
  steps: AskStep[];
  /** Question envoyée par la dictée : lire la réponse dans cette langue quand elle arrive. */
  voiceReplyLanguage?: 'fr' | 'wo';
  response?: AskResponse;
  transportError?: string;
  aborted?: boolean;
}
