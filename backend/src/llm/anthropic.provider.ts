import Anthropic from '@anthropic-ai/sdk';
import { ProviderUnavailableError, type ChatMessage, type CompletionRequest, type CompletionResult, type LlmProvider, type ToolSpec } from './types.js';

/** Fournisseur principal : API Anthropic (Messages, appel d'outils, schémas stricts, cache du prompt). */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens,
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        tools: req.tools.map(toAnthropicTool),
        messages: toAnthropicMessages(req.messages),
      });
    } catch (err) {
      // Message court pour l'utilisateur ; le détail complet reste dans `cause` pour les journaux.
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw new ProviderUnavailableError(this.name, 'clé API refusée', err);
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new ProviderUnavailableError(this.name, 'quota ou limite de débit atteint', err);
      }
      if (err instanceof Anthropic.APIConnectionError) {
        throw new ProviderUnavailableError(this.name, 'service injoignable', err);
      }
      if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) {
        throw new ProviderUnavailableError(this.name, `erreur serveur (${err.status})`, err);
      }
      throw err;
    }

    if (message.stop_reason === 'refusal') {
      throw new ProviderUnavailableError(this.name, 'le modèle a refusé de traiter cette question');
    }
    const toolCalls = message.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return {
      text,
      toolCalls,
      stopReason: message.stop_reason === 'max_tokens' ? 'max_tokens' : toolCalls.length ? 'tool_use' : 'end',
      model: message.model,
    };
  }
}

function toAnthropicTool(t: ToolSpec): Anthropic.Tool {
  return {
    name: t.name,
    description: t.description,
    strict: true,
    input_schema: t.parameters as Anthropic.Tool['input_schema'],
  };
}

/** Un message assistant avec appels d'outils est suivi d'un message user portant les résultats. */
function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.text });
    } else if (m.role === 'assistant') {
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.text) content.push({ type: 'text', text: m.text });
      for (const c of m.toolCalls) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input });
      out.push({ role: 'assistant', content: content.length ? content : [{ type: 'text', text: ' ' }] });
    } else {
      const block: Anthropic.ToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: m.toolCallId,
        content: m.content,
        ...(m.isError ? { is_error: true } : {}),
      };
      const last = out[out.length - 1];
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        (last.content as Anthropic.ContentBlockParam[]).push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
    }
  }
  return out;
}
