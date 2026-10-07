import { describe, expect, it } from 'vitest';
import { formatForSms } from './sms.service.js';
import type { AskResponse } from '../assistant/assistant.types.js';

const base: AskResponse = {
  status: 'answered',
  question: 'q',
  answer: 'La population de la Région de Dakar est de 4 004 426 habitants en 2023.',
  answerWolof: null,
  suggestions: [],
  data: [
    {
      indicatorId: 'x',
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
      verifiedAt: '2026-09-15',
    },
  ],
  surveys: [],
  chart: null,
  followUps: [],
  meta: { model: 'm', provider: 'test', fallbackFrom: null, retrievedAt: '2026-09-15T10:00:00.000Z', guard: 'passed', violations: [], toolCalls: [], latencyMs: 1, language: 'fr', cached: false, permalink: null, attribution: 'a' },
};

describe('formatForSms', () => {
  it('tient en trois segments avec la source et le lien', () => {
    const t = formatForSms(base);
    expect(t.length).toBeLessThanOrEqual(480);
    expect(t).toContain('Source: ANSD — RGPH-5 (2023). https://www.ansd.sn/x');
    expect(t).toContain('CC BY 4.0');
  });

  it('propose une reformulation quand la donnée est absente', () => {
    const t = formatForSms({ ...base, status: 'no_data', data: [], suggestions: ['Population de Thiès ?'], answer: 'Pas de donnée.' });
    expect(t).toContain('Essayez: Population de Thiès ?');
  });
});
