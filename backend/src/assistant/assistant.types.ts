import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { GuardResult } from './answer-renderer.js';
import type { ChartHint } from './chart.js';
import type { FollowUp } from './follow-ups.js';
import type { Language } from './wolof.js';

export type AnswerStatus = 'answered' | 'no_data' | 'conversation' | 'error';

/** Un tour précédent de la conversation, texte seul, fourni par le client. */
export class HistoryTurn {
  @ApiProperty({ enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  @ApiProperty({ description: 'Texte du tour (question ou réponse rendue)', maxLength: 1000 })
  text: string;
}

export class AskRequest {
  @ApiProperty({ example: 'Quelle est la population de la région de Dakar ?', minLength: 2, maxLength: 500 })
  question: string;

  @ApiPropertyOptional({ type: [HistoryTurn], description: 'Derniers tours de la conversation (8 max)' })
  history?: HistoryTurn[];

  @ApiPropertyOptional({ enum: ['fr', 'wo'], description: 'Langue imposée (dictée vocale). Sinon détection automatique.' })
  language?: 'fr' | 'wo';
}

/** Un enregistrement cité dans la réponse, avec sa traçabilité complète. */
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

/** Une étude ANADS citée : métadonnées uniquement. */
export interface CitedSurvey {
  idno: string;
  title: string;
  label: string;
  yearStart: number | null;
  yearEnd: number | null;
  authoringEntity: string | null;
  url: string;
}

export interface ToolCallTrace {
  tool: string;
  input: unknown;
  resultSummary: string;
}

export interface AskResponse {
  status: AnswerStatus;
  question: string;
  answer: string;
  /** Rendu wolof de la réponse (traduction locale, valeurs protégées) quand la question était en wolof et le traducteur actif. */
  answerWolof: string | null;
  suggestions: string[];
  data: CitedRecord[];
  surveys: CitedSurvey[];
  /** Présent quand les enregistrements forment une évolution ou une comparaison. */
  chart: ChartHint | null;
  /** Suggestions de suite construites depuis la base (autres territoires, autres périodes). */
  followUps: FollowUp[];
  meta: {
    model: string;
    /** Fournisseur ayant produit la réponse (anthropic, groq…) et bascule éventuelle. */
    provider: string;
    fallbackFrom: string | null;
    retrievedAt: string; // ISO 8601, horodatage de la récupération en base
    guard: GuardResult | null;
    violations: string[];
    toolCalls: ToolCallTrace[];
    latencyMs: number;
    language: Language;
    cached: boolean;
    /** Identifiant court de la réponse partageable (page /r/:id), null si non enregistrée. */
    permalink: string | null;
    attribution: string;
  };
}

export const ATTRIBUTION =
  "Ce produit a été adapté à partir des informations de l'ANSD, sous licence conformément à l'Accord de licence de données ouvertes de l'ANSD (CC BY 4.0).";

/** Événement émis pendant le traitement d'une question (flux SSE). */
export type AskEvent =
  | { type: 'step'; step: AskStep }
  | { type: 'answer'; response: AskResponse }
  | { type: 'error'; message: string };

export interface AskStep {
  kind: 'language' | 'translate' | 'fallback' | 'cache' | 'search' | 'fetch' | 'surveys' | 'no_data' | 'compose' | 'guard';
  label: string;
  detail?: string;
  at: string;
}
