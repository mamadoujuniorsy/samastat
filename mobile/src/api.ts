import { fetch as expoFetch } from 'expo/fetch';
import type { AskEvent, AskResponse, HistoryTurn, IndicatorDetail, IndicatorSummary } from './types';

/**
 * URL de l'API SamaStat. Sur un appareil physique, mettre l'adresse LAN du poste
 * (ex. http://192.168.1.20:3001) dans mobile/.env sous EXPO_PUBLIC_API_URL.
 * L'émulateur Android atteint l'hôte via http://10.0.2.2:3001.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

/** Adresse du site web (liens permanents /r/:id dans les partages) ; vide = pas de lien. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/$/, '');

export function permalinkUrl(id: string | null): string | null {
  return id && WEB_URL ? `${WEB_URL}/r/${id}` : null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const UNREACHABLE = "Impossible de joindre l'API SamaStat. Vérifiez la connexion et l'adresse du serveur.";

function withTimeout(ms: number, parent?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  parent?.addEventListener('abort', () => {
    clearTimeout(t);
    controller.abort();
  });
  return controller.signal;
}

/**
 * Question en flux : chaque événement SSE (étape, réponse, erreur) est remonté via onEvent.
 * Utilise le fetch d'Expo, qui expose le corps de réponse en flux sur iOS et Android.
 */
export async function askStream(
  question: string,
  history: HistoryTurn[],
  onEvent: (event: AskEvent) => void,
  signal?: AbortSignal,
  language?: 'fr' | 'wo',
): Promise<AskResponse> {
  let res: Awaited<ReturnType<typeof expoFetch>>;
  try {
    res = await expoFetch(`${API_URL}/ask/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ question, history, language }),
      signal: withTimeout(180_000, signal),
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(UNREACHABLE);
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? `Le service a répondu avec une erreur (${res.status}).`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: AskResponse | null = null;
  let errorMessage: string | null = null;

  const handle = (block: string) => {
    const data = block
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('\n');
    if (!data) return;
    let event: AskEvent;
    try {
      event = JSON.parse(data) as AskEvent;
    } catch {
      return;
    }
    onEvent(event);
    if (event.type === 'answer') final = event.response;
    if (event.type === 'error') errorMessage = event.message;
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.trim()) handle(buffer);

  if (final) return final;
  throw new ApiError(errorMessage ?? "Le flux s'est terminé sans réponse.");
}

export async function fetchCatalogue(): Promise<IndicatorSummary[]> {
  try {
    const res = await fetch(`${API_URL}/indicators`, { signal: withTimeout(10_000) });
    if (!res.ok) return [];
    const body = (await res.json()) as { indicators?: IndicatorSummary[] };
    return body.indicators ?? [];
  } catch {
    return [];
  }
}

export async function fetchHealth(): Promise<{ indicators: number; surveys: number } | null> {
  try {
    const res = await fetch(`${API_URL}/health`, { signal: withTimeout(5_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { indicators?: number; surveys?: number };
    return typeof j.indicators === 'number' ? { indicators: j.indicators, surveys: j.surveys ?? 0 } : null;
  } catch {
    return null;
  }
}

export async function fetchIndicatorDetail(id: string): Promise<IndicatorDetail> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/indicators/${encodeURIComponent(id)}`, { signal: withTimeout(15_000) });
  } catch {
    throw new ApiError(UNREACHABLE);
  }
  if (!res.ok) throw new ApiError(`Fiche indisponible (${res.status}).`, res.status);
  return (await res.json()) as IndicatorDetail;
}

export async function transcribeAudio(
  uri: string,
  language: 'auto' | 'fr' | 'wo',
): Promise<{ text: string; language: 'fr' | 'wo' }> {
  const ext = uri.split('.').pop()?.toLowerCase().split('?')[0] ?? 'm4a';
  const type = ext === 'webm' ? 'audio/webm' : ext === '3gp' ? 'audio/3gpp' : ext === 'ogg' ? 'audio/ogg' : 'audio/mp4';
  const name = `question.${ext === 'webm' ? 'webm' : ext === '3gp' ? '3gp' : ext === 'ogg' ? 'ogg' : 'm4a'}`;
  const form = new FormData();
  form.append('audio', { uri, name, type } as unknown as Blob);
  form.append('language', language);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/wolof/transcribe`, { method: 'POST', body: form, signal: withTimeout(50_000) });
  } catch {
    throw new ApiError(UNREACHABLE);
  }
  const data = (await res.json().catch(() => null)) as { text?: string; language?: string; message?: string } | null;
  if (!res.ok || !data?.text?.trim()) {
    throw new ApiError(data?.message ?? 'La transcription a échoué. Réessayez ou saisissez votre question.', res.status);
  }
  return { text: data.text.trim(), language: data.language === 'wo' ? 'wo' : 'fr' };
}

/** URL de la voix wolof (GET) pour un lecteur audio. */
export function wolofTtsUrl(text: string): string {
  return `${API_URL}/wolof/tts?text=${encodeURIComponent(text.slice(0, 400))}`;
}

/** URL d'export des enregistrements (CSV ou JSON), à ouvrir dans le navigateur. */
export function exportUrl(ids: string[], format: 'csv' | 'json'): string {
  return `${API_URL}/export?ids=${encodeURIComponent(ids.join(','))}&format=${format}`;
}
