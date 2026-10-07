import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { LlmService, NoProviderError } from './llm.service.js';
import { ProviderUnavailableError, type CompletionRequest, type CompletionResult, type LlmProvider } from './types.js';

const req: CompletionRequest = { system: 's', tools: [], messages: [{ role: 'user', text: 'q' }], maxTokens: 10 };
const ok = (model: string): CompletionResult => ({ text: 'ok', toolCalls: [], stopReason: 'end', model });

function service(env: Record<string, string>): LlmService {
  return new LlmService(new ConfigService(env));
}

function stub(p: LlmProvider | null, impl: () => Promise<CompletionResult>) {
  if (!p) throw new Error('provider attendu');
  vi.spyOn(p, 'complete').mockImplementation(impl);
}

describe('LlmService', () => {
  it('refuse toute question sans clé', async () => {
    const s = service({});
    expect(s.configured).toBe(false);
    await expect(s.complete(req)).rejects.toBeInstanceOf(NoProviderError);
  });

  it('utilise Anthropic en principal et Groq en repli', () => {
    const s = service({ ANTHROPIC_API_KEY: 'a', GROQ_API_KEY: 'g' });
    expect(s.primary?.name).toBe('anthropic');
    expect(s.fallback?.name).toBe('groq');
    expect(s.fallback?.model).toBe('openai/gpt-oss-120b');
    expect(s.defaultModel).toBe('claude-opus-5');
  });

  it('fonctionne avec Groq seul', async () => {
    const s = service({ GROQ_API_KEY: 'g' });
    expect(s.primary).toBeNull();
    stub(s.fallback, async () => ok('llama'));
    const out = await s.complete(req);
    expect(out.provider).toBe('groq');
  });

  it('bascule sur le repli quand le principal est indisponible, puis le met en pause', async () => {
    const s = service({ ANTHROPIC_API_KEY: 'a', GROQ_API_KEY: 'g' });
    const primary = vi.spyOn(s.primary!, 'complete').mockRejectedValue(new ProviderUnavailableError('anthropic', 'quota'));
    stub(s.fallback, async () => ok('llama'));
    const onFallback = vi.fn();

    const first = await s.complete(req, onFallback);
    expect(first.provider).toBe('groq');
    expect(onFallback).toHaveBeenCalledWith('anthropic', 'groq', expect.stringContaining('quota'));

    // Pendant la pause, le principal n'est plus sollicité.
    const second = await s.complete(req, onFallback);
    expect(second.provider).toBe('groq');
    expect(primary).toHaveBeenCalledTimes(1);
    expect(s.defaultModel).toBe('openai/gpt-oss-120b');
  });

  it('propage les erreurs non liées à la disponibilité sans basculer', async () => {
    const s = service({ ANTHROPIC_API_KEY: 'a', GROQ_API_KEY: 'g' });
    stub(s.primary, async () => {
      throw new Error('schéma invalide');
    });
    const fb = vi.spyOn(s.fallback!, 'complete');
    await expect(s.complete(req)).rejects.toThrow('schéma invalide');
    expect(fb).not.toHaveBeenCalled();
  });
});
