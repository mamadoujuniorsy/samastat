import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantService } from '../assistant/assistant.service.js';
import type { AskResponse, HistoryTurn } from '../assistant/assistant.types.js';

interface TelegramChat {
  id?: number;
}

interface TelegramMessage {
  chat?: TelegramChat;
  text?: string;
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string | undefined;
  private readonly webhookSecret: string | undefined;
  private readonly history = new Map<number, { turns: HistoryTurn[]; updatedAt: number }>();
  private readonly handledUpdates = new Map<number, number>();

  constructor(
    config: ConfigService,
    private readonly assistant: AssistantService,
  ) {
    this.token = config.get<string>('TELEGRAM_BOT_TOKEN')?.trim() || undefined;
    this.webhookSecret = config.get<string>('TELEGRAM_WEBHOOK_SECRET')?.trim() || undefined;
    if (!this.enabled) this.logger.log('Canal Telegram inactif (TELEGRAM_BOT_TOKEN absent).');
  }

  get enabled(): boolean {
    return Boolean(this.token);
  }

  get configuredWebhookSecret(): boolean {
    return Boolean(this.webhookSecret);
  }

  verifyWebhookSecret(received: string | undefined): boolean {
    return !this.webhookSecret || received === this.webhookSecret;
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const updateId = update.update_id;
    const chatId = update.message?.chat?.id;
    const text = update.message?.text?.trim().slice(0, 500);
    if (typeof chatId !== 'number' || !text || text.length < 2) return;
    if (typeof updateId === 'number' && this.handledUpdates.has(updateId)) return;
    if (typeof updateId === 'number') this.handledUpdates.set(updateId, Date.now());
    this.prune();

    const entry = this.history.get(chatId) ?? { turns: [], updatedAt: 0 };
    const response = await this.assistant.ask({ question: text, history: entry.turns });
    if (response.status !== 'error') {
      const next: HistoryTurn[] = [
        ...entry.turns,
        { role: 'user', text },
        { role: 'assistant', text: response.answerWolof ?? response.answer },
      ];
      entry.turns = next.slice(-8);
    }
    entry.updatedAt = Date.now();
    this.history.set(chatId, entry);
    await this.sendMessage(chatId, formatForTelegram(response));
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    if (!this.token) return;
    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      this.logger.warn(`Envoi Telegram refusé (${response.status}) : ${(await response.text()).slice(0, 200)}`);
    }
  }

  private prune(): void {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [chatId, value] of this.history) if (value.updatedAt < cutoff) this.history.delete(chatId);
    for (const [updateId, timestamp] of this.handledUpdates) {
      if (timestamp < cutoff) this.handledUpdates.delete(updateId);
    }
  }
}

export function formatForTelegram(response: AskResponse): string {
  const parts = [response.answer.replace(/\s+/g, ' ').trim()];
  if (response.data.length) {
    for (const record of response.data.slice(0, 3)) {
      parts.push(`• ${record.name} — ${record.formattedValue} (${record.territory}, ${record.period})`);
      parts.push(`Source : ${record.source} — ${record.url}`);
    }
    if (response.data.length > 3) parts.push(`+${response.data.length - 3} autre(s) valeur(s) dans le catalogue SamaStat.`);
  } else if (response.suggestions.length) {
    parts.push(`Suggestions :\n${response.suggestions.slice(0, 3).map((item) => `• ${item}`).join('\n')}`);
  }
  parts.push('Données ANSD — CC BY 4.0.');
  return parts.join('\n\n').slice(0, 4096);
}
