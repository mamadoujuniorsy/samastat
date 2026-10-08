import { Injectable, Logger } from '@nestjs/common';
import { LlmService, NoProviderError } from '../llm/llm.service.js';
import { ProviderUnavailableError, type ChatMessage, type ToolCall } from '../llm/types.js';
import { IndicatorsRepository } from '../indicators/indicators.repository.js';
import { SurveysRepository, type Survey } from '../indicators/surveys.repository.js';
import type { Indicator } from '../indicators/indicator.types.js';
import { SYSTEM_PROMPT, TOOLS } from './tools.js';
import { fallbackAnswer, formatValue, renderAnswer, surveyLabel } from './answer-renderer.js';
import {
  ATTRIBUTION,
  type AskEvent,
  type AskRequest,
  type AskResponse,
  type AskStep,
  type CitedRecord,
  type CitedSurvey,
  type HistoryTurn,
  type ToolCallTrace,
} from './assistant.types.js';
import { buildChart } from './chart.js';
import { buildFollowUps } from './follow-ups.js';
import { AnswersService } from './answers.service.js';
import { CacheService } from './cache.service.js';
import { UsageLogService } from './usage-log.service.js';
import { detectLanguage, normalizeWolofForSearch, searchHints, type Language } from './wolof.js';
import { TranslationService } from '../wolof/translation.service.js';

const MAX_ITERATIONS = 6;
const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 1000;

/** État accumulé au fil des appels d'outils pour une question. */
interface RunState {
  retrieved: Map<string, Indicator>;
  surveys: Map<string, Survey>;
  noData: { reason: string; suggestions: string[] } | null;
  trace: ToolCallTrace[];
  language: Language;
  frenchQuestion: string | null;
  /** Fournisseur et modèle ayant réellement répondu, connus après le premier appel. */
  provider: string | null;
  model: string | null;
  fallbackFrom: string | null;
  emit: (step: Omit<AskStep, 'at'>) => void;
}

const plural = (n: number, s: string, p = `${s}s`) => (n > 1 ? p : s);

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly indicators: IndicatorsRepository,
    private readonly surveysRepo: SurveysRepository,
    private readonly usageLog: UsageLogService,
    private readonly cache: CacheService,
    private readonly translation: TranslationService,
    private readonly answers: AnswersService,
  ) {}

  /**
   * Traite une question. `onEvent` reçoit les étapes au fil de l'eau (recherche, récupération,
   * garde) puis la réponse : c'est ce que le flux SSE transmet aux clients.
   */
  async ask(request: AskRequest, onEvent?: (event: AskEvent) => void): Promise<AskResponse> {
    const started = Date.now();
    const question = request.question.trim();
    const history = sanitizeHistory(request.history);
    const state: RunState = {
      retrieved: new Map(),
      surveys: new Map(),
      noData: null,
      trace: [],
      language: request.language === 'wo' || request.language === 'fr' ? request.language : detectLanguage(question),
      frenchQuestion: null,
      provider: null,
      model: null,
      fallbackFrom: null,
      emit: (step) => onEvent?.({ type: 'step', step: { ...step, at: new Date().toISOString() } }),
    };
    state.emit({
      kind: 'language',
      label:
        state.language === 'wo'
          ? 'Question en wolof détectée'
          : state.language === 'fr'
            ? 'Question en français'
            : 'Langue indéterminée',
    });

    // Une question isolée déjà posée à l'identique ne repasse pas par le modèle.
    if (history.length === 0) {
      const hit = await this.cache.get(question);
      if (hit) {
        state.emit({ kind: 'cache', label: 'Réponse déjà connue, servie depuis le cache' });
        const cached: AskResponse = {
          ...hit,
          meta: { ...hit.meta, cached: true, latencyMs: Date.now() - started },
        };
        void this.usageLog.record(cached);
        onEvent?.({ type: 'answer', response: cached });
        return cached;
      }
    }

    let response: AskResponse;
    try {
      if (!this.llm.configured) throw new NoProviderError();
      const raw = await this.runToolLoop(question, history, state);
      state.emit({ kind: 'compose', label: 'Rédaction de la réponse à partir des enregistrements' });
      response = await this.buildResponse(question, raw, state, started);
    } catch (err) {
      this.logger.error(`Échec du traitement de « ${question} »`, err as Error);
      response = this.errorResponse(question, err, state, started);
    }

    if (response.status === 'answered' || (response.status === 'no_data' && response.surveys.length > 0)) {
      const id = await this.answers.save(response);
      if (id) response = { ...response, meta: { ...response.meta, permalink: id } };
    }
    if (history.length === 0 && response.status !== 'error') void this.cache.set(question, response);
    void this.usageLog.record(response);
    onEvent?.(response.status === 'error' ? { type: 'error', message: response.answer } : { type: 'answer', response });
    return response;
  }

  /** Boucle d'appel d'outils : le modèle cherche, récupère, puis formule. */
  private async runToolLoop(question: string, history: HistoryTurn[], state: RunState): Promise<string> {
    const messages: ChatMessage[] = history.map((t) =>
      t.role === 'user' ? { role: 'user', text: t.text } : { role: 'assistant', text: t.text, toolCalls: [] },
    );

    const notes: string[] = [];
    const normalizedQuestion = normalizeWolofForSearch(question);
    const hints = searchHints(normalizedQuestion);
    if (hints) notes.push(`Indices de vocabulaire wolof → français fournis par le serveur : ${hints}`);
    if (state.language === 'wo' && this.translation.available) {
      state.emit({ kind: 'translate', label: 'Traduction automatique de la question wolof vers le français' });
      const fr = await this.translation.toFrench(question);
      if (fr) {
        state.emit({ kind: 'translate', label: `Traduction : « ${fr} »`, detail: 'NLLB-200 en local ; le modèle vérifie avec la question d’origine' });
        notes.push(`Traduction automatique en français (peut être imparfaite) : « ${fr} »`);
        notes.push('Rédige une réponse canonique très courte ; le serveur produira la version wolof affichée à l’utilisateur.');
        state.frenchQuestion = fr;
      }
    }
    const userContent = notes.length ? `${question}\n\n[${notes.join(' — ')}]` : question;
    messages.push({ role: 'user', text: userContent });

    const onFallback = (from: string, to: string, reason: string) => {
      state.fallbackFrom = from;
      state.emit({
        kind: 'fallback',
        label: `Modèle principal (${from}) indisponible : bascule sur ${to}`,
        detail: reason,
      });
    };

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const result = await this.llm.complete({ system: SYSTEM_PROMPT, tools: TOOLS, messages, maxTokens: 4096 }, onFallback);
      state.provider = result.provider;
      state.model = result.model;

      if (result.stopReason === 'max_tokens') {
        throw new Error('Réponse tronquée par le modèle.');
      }
      if (result.stopReason !== 'tool_use' || result.toolCalls.length === 0) {
        return result.text;
      }

      messages.push({ role: 'assistant', text: result.text, toolCalls: result.toolCalls });
      for (const call of result.toolCalls) {
        const { content, isError } = await this.executeTool(call, state);
        messages.push({ role: 'tool', toolCallId: call.id, content, ...(isError ? { isError } : {}) });
      }
    }

    throw new Error("Nombre maximal d'appels d'outils atteint sans réponse.");
  }

  private async executeTool(use: ToolCall, state: RunState): Promise<{ content: string; isError: boolean }> {
    const input = use.input;
    try {
      switch (use.name) {
        case 'search_indicators': {
          const query = typeof input.query === 'string' ? input.query : '';
          const filters = {
            territory: typeof input.territory === 'string' ? input.territory : undefined,
            period: typeof input.period === 'string' ? input.period : undefined,
          };
          state.emit({
            kind: 'search',
            label: `Recherche dans le catalogue : « ${query || 'tout le catalogue'} »`,
            detail: [filters.territory, filters.period].filter(Boolean).join(' · ') || undefined,
          });
          const found = await this.indicators.search(query, filters);
          state.emit({
            kind: 'search',
            label: `${found.length} ${plural(found.length, 'indicateur candidat', 'indicateurs candidats')}`,
            detail: found
              .slice(0, 3)
              .map((f) => `${f.name} · ${f.territory} · ${f.period}`)
              .join(' ; '),
          });
          state.trace.push({
            tool: use.name,
            input,
            resultSummary: `${found.length} indicateur(s) : ${found.map((f) => `${f.id}${f.score != null ? ` (${f.score})` : ''}`).join(', ')}`,
          });
          return { content: JSON.stringify({ indicators: found }), isError: false };
        }
        case 'get_indicator_values': {
          const ids = Array.isArray(input.ids) ? input.ids.filter((x): x is string => typeof x === 'string') : [];
          const records = await this.indicators.getByIds(ids);
          for (const r of records) state.retrieved.set(r.id, r);
          state.emit({
            kind: 'fetch',
            label: `${records.length} ${plural(records.length, 'valeur récupérée', 'valeurs récupérées')} en base`,
            detail: records.map((r) => `${r.name} · ${r.territory} · ${r.period}`).join(' ; '),
          });
          const missing = ids.filter((id) => !records.some((r) => r.id === id));
          state.trace.push({
            tool: use.name,
            input,
            resultSummary: `${records.length} enregistrement(s) récupéré(s)${missing.length ? `, introuvables : ${missing.join(', ')}` : ''}`,
          });
          return {
            content: JSON.stringify({
              records: records.map((r) => ({ ...r, formatted_value: formatValue(r) })),
              missing_ids: missing,
            }),
            isError: false,
          };
        }
        case 'search_surveys': {
          const query = typeof input.query === 'string' ? input.query : '';
          state.emit({ kind: 'surveys', label: `Recherche dans le catalogue ANADS : « ${query} »` });
          const found = await this.surveysRepo.search(query);
          for (const s of found) state.surveys.set(s.idno, s);
          state.emit({
            kind: 'surveys',
            label: `${found.length} ${plural(found.length, 'étude trouvée', 'études trouvées')}`,
            detail: found.slice(0, 3).map((s) => s.title).join(' ; '),
          });
          state.trace.push({
            tool: use.name,
            input,
            resultSummary: `${found.length} étude(s) : ${found.map((s) => s.idno).join(', ')}`,
          });
          return {
            content: JSON.stringify({
              surveys: found.map((s) => ({
                idno: s.idno,
                title: s.title,
                years: [s.year_start, s.year_end],
                authoring_entity: s.authoring_entity,
                abstract: s.abstract,
                url: s.url,
                score: s.score,
              })),
            }),
            isError: false,
          };
        }
        case 'report_no_data': {
          const reason = typeof input.reason === 'string' ? input.reason : '';
          const suggestions = Array.isArray(input.suggested_questions)
            ? input.suggested_questions.filter((x): x is string => typeof x === 'string').slice(0, 4)
            : [];
          state.noData = { reason, suggestions };
          state.emit({
            kind: 'no_data',
            label: 'Aucun indicateur ne correspond : absence de donnée déclarée',
            detail: reason || undefined,
          });
          state.trace.push({ tool: use.name, input, resultSummary: 'absence de donnée déclarée' });
          return { content: JSON.stringify({ acknowledged: true }), isError: false };
        }
        default:
          return { content: `Outil inconnu : ${use.name}`, isError: true };
      }
    } catch (err) {
      this.logger.warn(`Outil ${use.name} en erreur : ${(err as Error).message}`);
      return { content: `Erreur d'exécution de ${use.name}`, isError: true };
    }
  }

  private async buildResponse(question: string, raw: string, state: RunState, started: number): Promise<AskResponse> {
    const records = [...state.retrieved.values()];
    const retrievedAt = new Date().toISOString();
    // Seules les études effectivement citées par le modèle sont restituées.
    const citedIdnos = new Set(
      [...raw.matchAll(/\{\{\s*survey(?:_url)?\s*:\s*([A-Za-z0-9._-]+)\s*\}\}/g)].map((m) => m[1]),
    );
    const surveys = [...state.surveys.values()].filter((s) => citedIdnos.has(s.idno));

    if (records.length > 0 || surveys.length > 0) {
      const rendered = renderAnswer(raw, records, [...state.surveys.values()]);
      if (rendered.guard === 'fallback') {
        this.logger.warn(`Garde anti-invention déclenchée : ${rendered.violations.join(' | ')}`);
        state.emit({
          kind: 'guard',
          label: 'Formulation libre rejetée par la garde anti-invention, texte reconstruit depuis la base',
          detail: rendered.violations.join(' | '),
        });
      } else {
        state.emit({ kind: 'guard', label: 'Garde anti-invention : aucun chiffre écrit par le modèle' });
      }
      const citedSurveys = rendered.guard === 'fallback' ? [...state.surveys.values()].slice(0, 3) : surveys;
      const related = records.length ? await this.indicators.related(records[0].name, records[0].unit) : [];
      const answerWolof = await this.wolofVersion(rendered.text, records, citedSurveys, state);
      return {
        status: records.length > 0 ? 'answered' : 'no_data',
        question,
        answer: rendered.text,
        answerWolof,
        suggestions: state.noData?.suggestions ?? [],
        data: records.map(toCited),
        surveys: citedSurveys.map(toCitedSurvey),
        chart: buildChart(records),
        followUps: buildFollowUps(records, related),
        meta: this.meta(state, retrievedAt, rendered.guard, rendered.violations, started),
      };
    }

    // Aucune valeur récupérée : le texte ne doit contenir aucun chiffre.
    const hasDigits = /\d/.test(raw.replace(/\{\{[^}]*\}\}/g, ''));
    if (state.noData || hasDigits) {
      return {
        status: 'no_data',
        question,
        answer: hasDigits ? fallbackAnswer([]) : raw || fallbackAnswer([]),
        answerWolof: null,
        suggestions: state.noData?.suggestions ?? [],
        data: [],
        surveys: [],
        chart: null,
        followUps: [],
        meta: this.meta(
          state,
          retrievedAt,
          hasDigits ? 'fallback' : 'passed',
          hasDigits ? ['chiffres sans enregistrement récupéré'] : [],
          started,
        ),
      };
    }

    return {
      status: 'conversation',
      question,
      answer: raw,
      answerWolof: null,
      suggestions: [],
      data: [],
      surveys: [],
      chart: null,
      followUps: [],
      meta: this.meta(state, retrievedAt, 'passed', [], started),
    };
  }

  /**
   * Version wolof de la réponse : traduction locale du texte français, valeurs, périodes et
   * sources protégées par jetons. null si la question n'était pas en wolof, si le traducteur est
   * inactif, ou si la traduction a altéré un jeton.
   */
  private async wolofVersion(french: string, records: Indicator[], surveys: Survey[], state: RunState): Promise<string | null> {
    if (!this.translation.available) return null;
    const segments = [
      ...records.flatMap((r) => [formatValue(r), r.period, r.source]),
      ...surveys.flatMap((s) => [surveyLabel(s), s.url]),
    ]
      .filter((seg) => french.includes(seg))
      .sort((x, y) => y.length - x.length);
    // Ordre d'apparition dans le texte, pour des jetons numérotés de gauche à droite.
    const ordered = [...new Set(segments)].sort((x, y) => french.indexOf(x) - french.indexOf(y));
    state.emit({ kind: 'translate', label: 'Traduction de la réponse vers le wolof, valeurs protégées' });
    const wo = await this.translation.renderWolof(french, ordered);
    state.emit({ kind: 'translate', label: wo ? 'Version wolof produite' : 'Version wolof non retenue (valeur altérée par la traduction)' });
    return wo;
  }

  private errorResponse(question: string, err: unknown, state: RunState, started: number): AskResponse {
    let answer = "Le service n'a pas pu traiter la question. Réessayez dans un instant.";
    if (err instanceof NoProviderError) {
      answer = "Le service n'est pas configuré (aucune clé de modèle).";
    } else if (err instanceof ProviderUnavailableError) {
      answer = 'Le service de compréhension est indisponible pour le moment (modèle principal et repli). Réessayez dans un instant.';
    }
    return {
      status: 'error',
      question,
      answer,
      answerWolof: null,
      suggestions: [],
      data: [],
      surveys: [],
      chart: null,
      followUps: [],
      meta: this.meta(state, new Date().toISOString(), null, [(err as Error).message], started),
    };
  }

  private meta(
    state: RunState,
    retrievedAt: string,
    guard: AskResponse['meta']['guard'],
    violations: string[],
    started: number,
  ): AskResponse['meta'] {
    return {
      model: state.model ?? this.llm.defaultModel,
      provider: state.provider ?? (this.llm.primary?.name ?? this.llm.fallback?.name ?? 'aucun'),
      fallbackFrom: state.fallbackFrom,
      retrievedAt,
      guard,
      violations,
      toolCalls: state.trace,
      latencyMs: Date.now() - started,
      language: state.language,
      cached: false,
      permalink: null,
      attribution: ATTRIBUTION,
    };
  }
}

/** Historique borné et nettoyé : texte seul, rôles alternés, derniers tours uniquement. */
function sanitizeHistory(history: HistoryTurn[] | undefined): HistoryTurn[] {
  if (!Array.isArray(history)) return [];
  const clean = history
    .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string' && t.text.trim())
    .map((t) => ({ role: t.role, text: t.text.trim().slice(0, MAX_HISTORY_CHARS) }))
    .slice(-MAX_HISTORY_TURNS);
  // L'API exige une alternance stricte commençant par l'utilisateur.
  const alternating: HistoryTurn[] = [];
  for (const t of clean) {
    const last = alternating[alternating.length - 1];
    if (!last && t.role !== 'user') continue;
    if (last && last.role === t.role) {
      last.text = `${last.text}\n${t.text}`;
      continue;
    }
    alternating.push({ ...t });
  }
  if (alternating.length && alternating[alternating.length - 1].role === 'user') alternating.pop();
  return alternating;
}

function toCited(r: Indicator): CitedRecord {
  return {
    indicatorId: r.id,
    name: r.name,
    value: r.value,
    formattedValue: formatValue(r),
    unit: r.unit,
    territory: r.territory,
    territoryLevel: r.territory_level,
    period: r.period,
    source: r.source,
    platform: r.platform,
    url: r.url,
    domain: r.domain,
    verifiedAt: r.verified_at,
  };
}

function toCitedSurvey(s: Survey): CitedSurvey {
  return {
    idno: s.idno,
    title: s.title,
    label: surveyLabel(s),
    yearStart: s.year_start,
    yearEnd: s.year_end,
    authoringEntity: s.authoring_entity,
    url: s.url,
  };
}
