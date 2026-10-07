import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantService } from '../assistant/assistant.service.js';
import type { AskResponse, HistoryTurn } from '../assistant/assistant.types.js';

/**
 * Canal SMS (zones à faible connectivité, format prévu par l'appel à propositions).
 * Fournisseur : Africa's Talking (API SMS dominante en Afrique de l'Ouest), activé uniquement si
 * SMS_AT_USERNAME et SMS_AT_API_KEY sont définis. Le contexte par numéro est gardé en mémoire,
 * borné ; le numéro n'est jamais journalisé.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly username: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly sender: string | undefined;
  private readonly baseUrl: string;
  private readonly history = new Map<string, { turns: HistoryTurn[]; updatedAt: number }>();

  constructor(
    config: ConfigService,
    private readonly assistant: AssistantService,
  ) {
    this.username = config.get<string>('SMS_AT_USERNAME')?.trim() || undefined;
    this.apiKey = config.get<string>('SMS_AT_API_KEY')?.trim() || undefined;
    this.sender = config.get<string>('SMS_AT_SENDER_ID')?.trim() || undefined;
    this.baseUrl =
      config.get<string>('SMS_AT_BASE_URL')?.trim() ||
      (this.username === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com');
    if (!this.enabled) this.logger.log('Canal SMS inactif (SMS_AT_USERNAME / SMS_AT_API_KEY absents).');
  }

  get enabled(): boolean {
    return Boolean(this.username && this.apiKey);
  }

  async handleIncoming(from: string, text: string): Promise<void> {
    const entry = this.history.get(from) ?? { turns: [], updatedAt: 0 };
    const response = await this.assistant.ask({ question: text, history: entry.turns });
    if (response.status !== 'error') {
      const next: HistoryTurn[] = [...entry.turns, { role: 'user', text }, { role: 'assistant', text: response.answer }];
      entry.turns = next.slice(-6);
    }
    entry.updatedAt = Date.now();
    this.history.set(from, entry);
    this.prune();
    await this.send(from, formatForSms(response));
  }

  /** Envoi via l'API REST Africa's Talking (formulaire x-www-form-urlencoded). */
  async send(to: string, message: string): Promise<void> {
    if (!this.enabled) return;
    const body = new URLSearchParams({ username: this.username!, to, message });
    if (this.sender) body.set('from', this.sender);
    const res = await fetch(`${this.baseUrl}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: this.apiKey!, accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) this.logger.warn(`Envoi SMS refusé (${res.status}) : ${(await res.text()).slice(0, 200)}`);
  }

  private prune(): void {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [k, v] of this.history) if (v.updatedAt < cutoff) this.history.delete(k);
  }
}

/**
 * Texte SMS : réponse courte, valeur et source abrégée, lien. Les SMS longs sont concaténés par
 * l'opérateur ; on borne à 480 caractères (trois segments GSM) pour rester lisible et économique.
 */
export function formatForSms(r: AskResponse): string {
  const parts = [r.answer.replace(/\s+/g, ' ').trim()];
  if (r.data.length) {
    const d = r.data[0];
    parts.push(`Source: ${d.source}. ${d.url}`);
    if (r.data.length > 1) parts.push(`+${r.data.length - 1} autre(s) valeur(s) sur SamaStat.`);
  } else if (r.suggestions.length) {
    parts.push(`Essayez: ${r.suggestions[0]}`);
  }
  parts.push('Données ANSD, CC BY 4.0.');
  const text = parts.join(' ');
  return text.length > 480 ? `${text.slice(0, 477)}…` : text;
}
