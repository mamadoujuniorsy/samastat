import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { formatForWhatsapp, spokenReplyText, WhatsappService } from './whatsapp.service.js';
import type { AskResponse } from '../assistant/assistant.types.js';
import type { AssistantService } from '../assistant/assistant.service.js';

const base: AskResponse = {
  status: 'answered',
  question: 'Population de Dakar ?',
  answer: 'La population de la Région de Dakar est de 4 004 426 habitants en 2023.',
  answerWolof: null,
  suggestions: [],
  data: [
    {
      indicatorId: 'rgph5-2023-population-region-dakar',
      name: 'Population résidente',
      value: 4004426,
      formattedValue: '4 004 426 habitants',
      unit: 'habitants',
      territory: 'Région de Dakar',
      territoryLevel: 'region',
      period: '2023',
      source: 'ANSD — RGPH-5 (2023)',
      platform: 'ansd.sn',
      url: 'https://www.ansd.sn/x',
      domain: 'démographie',
      verifiedAt: null,
    },
  ],
  surveys: [],
  chart: null,
  followUps: [],
  meta: {
    model: 'm',
    provider: 'test',
    fallbackFrom: null,
    retrievedAt: '2026-09-15T10:00:00.000Z',
    guard: 'passed',
    violations: [],
    toolCalls: [],
    latencyMs: 1,
    language: 'fr',
    cached: false,
    permalink: null,
    attribution: 'attr',
  },
};

describe('formatForWhatsapp', () => {
  it('inclut la réponse, la valeur, la source et le lien', () => {
    const text = formatForWhatsapp(base);
    expect(text).toContain(base.answer);
    expect(text).toContain('4 004 426 habitants');
    expect(text).toContain('https://www.ansd.sn/x');
    expect(text).toContain('CC BY 4.0');
  });

  it('liste les reformulations quand la donnée est absente', () => {
    const text = formatForWhatsapp({ ...base, status: 'no_data', data: [], suggestions: ['Q1', 'Q2'] });
    expect(text).toContain('• Q1');
    expect(text).not.toContain('CC BY');
  });

  it('met le wolof en premier quand la question l’était', () => {
    const text = formatForWhatsapp({
      ...base,
      answerWolof: 'Dakar am na 4 004 426 nit ci 2023.',
      meta: { ...base.meta, language: 'wo' },
    });
    expect(text.indexOf('Dakar am na')).toBeLessThan(text.indexOf(base.answer));
  });

  it('rappelle la transcription d’un vocal', () => {
    const text = formatForWhatsapp(base, 'Population Dakar ?');
    expect(text).toContain('Vocal compris : Population Dakar ?');
  });
});

describe('spokenReplyText', () => {
  it('prend le wolof pour une question wolof, pas le français (TTS wolof seulement)', () => {
    expect(spokenReplyText(base)).toBeNull();
    expect(
      spokenReplyText({
        ...base,
        answerWolof: 'Dakar am na 4 004 426 nit ci 2023.',
        meta: { ...base.meta, language: 'wo' },
      }),
    ).toContain('Dakar am na');
  });
});

describe('WhatsappService.verifySignature', () => {
  const config = new ConfigService({ WHATSAPP_APP_SECRET: 'secret', WHATSAPP_ACCESS_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '1' });
  const service = new WhatsappService(config, {} as AssistantService, {} as never);
  const body = Buffer.from('{"object":"whatsapp_business_account"}');

  it('accepte une signature valide et refuse une signature altérée', () => {
    const sig = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
    expect(service.verifySignature(body, sig)).toBe(true);
    expect(service.verifySignature(body, sig.replace(/.$/, (c) => (c === '0' ? '1' : '0')))).toBe(false);
    expect(service.verifySignature(undefined, sig)).toBe(false);
  });

  it('laisse passer sans secret configuré', () => {
    const open = new WhatsappService(new ConfigService({}), {} as AssistantService, {} as never);
    expect(open.verifySignature(body, undefined)).toBe(true);
    expect(open.enabled).toBe(false);
  });
});
