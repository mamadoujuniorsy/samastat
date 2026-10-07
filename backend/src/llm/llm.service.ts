import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicProvider } from './anthropic.provider.js';
import { OpenAiCompatibleProvider } from './openai-compatible.provider.js';
import { ProviderUnavailableError, type CompletionRequest, type CompletionResult, type LlmProvider } from './types.js';

export class NoProviderError extends Error {
  constructor() {
    super('Aucun fournisseur de modèle configuré (ANTHROPIC_API_KEY ou GROQ_API_KEY).');
  }
}

/**
 * Choix du fournisseur : Anthropic en principal, repli OpenAI-compatible (Groq par défaut).
 * Un fournisseur qui échoue pour une raison transitoire (clé, quota, réseau, refus) est mis en
 * pause quelques minutes, le temps de servir les questions avec le repli.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  readonly primary: LlmProvider | null;
  readonly fallback: LlmProvider | null;
  private primaryPausedUntil = 0;

  constructor(config: ConfigService) {
    const anthropicKey = config.get<string>('ANTHROPIC_API_KEY')?.trim();
    this.primary = anthropicKey ? new AnthropicProvider(anthropicKey, config.get<string>('SAMASTAT_MODEL')?.trim() || 'claude-opus-5') : null;

    const fallbackKey = (config.get<string>('SAMASTAT_FALLBACK_API_KEY') ?? config.get<string>('GROQ_API_KEY'))?.trim();
    this.fallback = fallbackKey
      ? new OpenAiCompatibleProvider(
          config.get<string>('SAMASTAT_FALLBACK_PROVIDER')?.trim() || 'groq',
          config.get<string>('SAMASTAT_FALLBACK_BASE_URL')?.trim() || 'https://api.groq.com/openai/v1',
          fallbackKey,
          config.get<string>('SAMASTAT_FALLBACK_MODEL')?.trim() || 'openai/gpt-oss-120b',
        )
      : null;

    if (!this.primary && !this.fallback) {
      this.logger.warn('Aucun fournisseur de modèle : ANTHROPIC_API_KEY et GROQ_API_KEY absents, /ask répondra « non configuré ».');
    } else {
      this.logger.log(
        `Modèles : principal ${this.primary ? `${this.primary.name} (${this.primary.model})` : 'aucun'}, repli ${this.fallback ? `${this.fallback.name} (${this.fallback.model})` : 'aucun'}`,
      );
    }
  }

  get configured(): boolean {
    return Boolean(this.primary || this.fallback);
  }

  /** Nom du modèle affiché avant tout appel (principal si disponible). */
  get defaultModel(): string {
    return (this.primaryAvailable ? this.primary : this.fallback)?.model ?? 'aucun';
  }

  private get primaryAvailable(): boolean {
    return Boolean(this.primary) && Date.now() >= this.primaryPausedUntil;
  }

  /**
   * Tente le principal puis le repli. `onFallback` est appelé une fois par question au moment
   * de la bascule, pour l'afficher à l'utilisateur.
   */
  async complete(req: CompletionRequest, onFallback?: (from: string, to: string, reason: string) => void): Promise<CompletionResult & { provider: string }> {
    if (!this.configured) throw new NoProviderError();
    const order: LlmProvider[] = [];
    if (this.primaryAvailable && this.primary) order.push(this.primary);
    if (this.fallback) order.push(this.fallback);
    if (!order.length && this.primary) order.push(this.primary); // principal en pause mais aucun repli : on tente quand même

    let lastError: unknown;
    for (let i = 0; i < order.length; i++) {
      const provider = order[i];
      try {
        const result = await provider.complete(req);
        return { ...result, provider: provider.name };
      } catch (err) {
        lastError = err;
        if (!(err instanceof ProviderUnavailableError)) throw err;
        const next = order[i + 1];
        if (provider === this.primary && next) {
          this.primaryPausedUntil = Date.now() + 2 * 60_000;
          this.logger.warn(`Principal ${provider.name} indisponible (${err.message}) : bascule sur ${next.name} pendant 2 min`);
          onFallback?.(provider.name, next.name, err.message);
        }
      }
    }
    throw lastError;
  }
}
