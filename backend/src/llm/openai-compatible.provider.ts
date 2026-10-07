import { ProviderUnavailableError, type ChatMessage, type CompletionRequest, type CompletionResult, type LlmProvider, type ToolCall } from './types.js';

/**
 * Fournisseur de repli : toute API « chat completions » compatible OpenAI avec appel d'outils.
 * Groq par défaut ; fonctionne aussi avec Gemini (point d'entrée compatible), Mistral, OpenRouter, Ollama.
 * Sans SDK : un appel HTTP, un format de réponse.
 */
interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}
interface OpenAiResponse {
  model?: string;
  choices?: { message: OpenAiMessage; finish_reason: string }[];
  error?: { message?: string };
}

export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(
    readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const body = {
      model: this.model,
      max_tokens: req.maxTokens,
      temperature: 0.2,
      messages: [{ role: 'system', content: req.system } as OpenAiMessage, ...toOpenAiMessages(req.messages)],
      tools: req.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: 'auto',
    };

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      throw new ProviderUnavailableError(this.name, `injoignable (${(err as Error).message})`, err);
    }
    const data = (await res.json().catch(() => null)) as OpenAiResponse | null;
    if (!res.ok || !data?.choices?.length) {
      const detail = data?.error?.message ?? `HTTP ${res.status}`;
      const short =
        res.status === 401 || res.status === 403
          ? 'clé API refusée'
          : res.status === 429
            ? 'quota ou limite de débit atteint'
            : res.status >= 500
              ? `erreur serveur (${res.status})`
              : !data?.choices?.length
                ? detail.length <= 220 ? detail : 'réponse vide'
                : null;
      if (short) throw new ProviderUnavailableError(this.name, short, detail);
      throw new Error(`${this.name} : ${detail}`);
    }

    const choice = data.choices[0];
    const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((c) => ({
      id: c.id,
      name: c.function.name,
      input: parseArguments(c.function.arguments),
    }));
    return {
      text: (choice.message.content ?? '').trim(),
      toolCalls,
      stopReason:
        choice.finish_reason === 'length' ? 'max_tokens' : toolCalls.length ? 'tool_use' : 'end',
      model: data.model ?? this.model,
    };
  }
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toOpenAiMessages(messages: ChatMessage[]): OpenAiMessage[] {
  return messages.map((m): OpenAiMessage => {
    if (m.role === 'user') return { role: 'user', content: m.text };
    if (m.role === 'assistant') {
      return {
        role: 'assistant',
        content: m.text || null,
        ...(m.toolCalls.length
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                id: c.id,
                type: 'function' as const,
                function: { name: c.name, arguments: JSON.stringify(c.input) },
              })),
            }
          : {}),
      };
    }
    return { role: 'tool', tool_call_id: m.toolCallId, content: m.isError ? `ERREUR : ${m.content}` : m.content };
  });
}
