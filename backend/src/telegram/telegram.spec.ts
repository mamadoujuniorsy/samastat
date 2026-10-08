import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { formatForTelegram, TelegramService } from './telegram.service.js';
import type { AskResponse } from '../assistant/assistant.types.js';

const response: AskResponse = {
  status: 'answered',
  question: 'Population du Sénégal ?',
  answer: 'La population du Sénégal est de 18 millions habitants.',
  answerWolof: null,
  suggestions: [],
  data: [{
    indicatorId: 'population-senegal',
    name: 'Population résidente',
    value: 18,
    formattedValue: '18 millions habitants',
    unit: 'habitants',
    territory: 'Sénégal',
    territoryLevel: 'national',
    period: '2023',
    source: 'ANSD — RGPH-5',
    platform: 'ansd.sn',
    url: 'https://www.ansd.sn',
    domain: 'démographie',
    verifiedAt: null,
  }],
  surveys: [],
  chart: null,
  followUps: [],
  meta: {
    model: 'test',
    provider: 'test',
    fallbackFrom: null,
    retrievedAt: '2026-10-08T00:00:00.000Z',
    guard: 'passed',
    violations: [],
    toolCalls: [],
    latencyMs: 1,
    language: 'fr',
    cached: false,
    permalink: null,
    attribution: 'ANSD',
  },
};

describe('formatForTelegram', () => {
  it('inclut la réponse et la source ANSD', () => {
    const text = formatForTelegram(response);
    expect(text).toContain(response.answer);
    expect(text).toContain('ANSD — RGPH-5');
    expect(text).toContain('https://www.ansd.sn');
  });
});

describe('TelegramService', () => {
  it('vérifie le secret webhook', () => {
    const service = new TelegramService(
      new ConfigService({ TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_WEBHOOK_SECRET: 'secret' }),
      {} as never,
    );
    expect(service.enabled).toBe(true);
    expect(service.verifyWebhookSecret('secret')).toBe(true);
    expect(service.verifyWebhookSecret('wrong')).toBe(false);
  });

  it('ignore les doublons de mise à jour', async () => {
    const assistant = { ask: vi.fn().mockResolvedValue(response) };
    const service = new TelegramService(
      new ConfigService({ TELEGRAM_BOT_TOKEN: 'token' }),
      assistant as never,
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const update = { update_id: 42, message: { chat: { id: 7 }, text: 'Population du Sénégal ?' } };
    await service.handleUpdate(update);
    await service.handleUpdate(update);
    expect(assistant.ask).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
