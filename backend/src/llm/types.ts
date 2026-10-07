/**
 * Contrat neutre entre la boucle d'appel d'outils et les fournisseurs de modèles.
 * Les outils, le prompt et la garde anti-invention ne dépendent d'aucun fournisseur.
 */
export interface ToolSpec {
  name: string;
  description: string;
  /** Schéma JSON des paramètres (objet). */
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string; isError?: boolean };

export interface CompletionRequest {
  system: string;
  tools: ToolSpec[];
  messages: ChatMessage[];
  maxTokens: number;
}

export interface CompletionResult {
  /** Texte de la réponse (peut accompagner des appels d'outils). */
  text: string;
  toolCalls: ToolCall[];
  stopReason: 'end' | 'tool_use' | 'max_tokens' | 'refusal';
  model: string;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

/** Erreur signalant qu'un autre fournisseur peut être tenté (quota, réseau, clé, refus). */
export class ProviderUnavailableError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(`${provider} : ${message}`);
  }
}
