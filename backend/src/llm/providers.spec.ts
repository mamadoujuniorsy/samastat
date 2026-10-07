import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleProvider } from './openai-compatible.provider.js';
import { ProviderUnavailableError, type CompletionRequest } from './types.js';

const req: CompletionRequest = {
  system: 'sys',
  maxTokens: 100,
  tools: [{ name: 'search_indicators', description: 'd', parameters: { type: 'object', properties: {} } }],
  messages: [
    { role: 'user', text: 'Population de Dakar ?' },
    { role: 'assistant', text: '', toolCalls: [{ id: 'c1', name: 'search_indicators', input: { query: 'population Dakar' } }] },
    { role: 'tool', toolCallId: 'c1', content: '{"indicators":[]}' },
  ],
};

describe('OpenAiCompatibleProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('convertit les messages et lit les appels d’outils de la réponse', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'llama-test',
          choices: [
            {
              finish_reason: 'tool_calls',
              message: { role: 'assistant', content: null, tool_calls: [{ id: 'x1', type: 'function', function: { name: 'get_indicator_values', arguments: '{"ids":["a"]}' } }] },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const p = new OpenAiCompatibleProvider('groq', 'https://api.groq.com/openai/v1', 'k', 'llama-test');
    const out = await p.complete(req);
    expect(out.stopReason).toBe('tool_use');
    expect(out.toolCalls).toEqual([{ id: 'x1', name: 'get_indicator_values', input: { ids: ['a'] } }]);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as { messages: { role: string; tool_call_id?: string; tool_calls?: unknown[] }[]; tools: { type: string }[] };
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[2].tool_calls).toHaveLength(1);
    expect(body.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
    expect(body.tools[0].type).toBe('function');
  });

  it('signale une indisponibilité sur 401 / 429 pour permettre la bascule', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 }));
    const p = new OpenAiCompatibleProvider('groq', 'https://api.groq.com/openai/v1', 'k', 'm');
    await expect(p.complete(req)).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});
