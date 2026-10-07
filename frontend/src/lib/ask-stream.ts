import type { AskEvent, AskResponse, HistoryTurn } from "./types";

/**
 * Appelle le relais /api/ask/stream et remonte chaque événement SSE (étape, réponse, erreur).
 * Résout avec la réponse finale ; rejette sur erreur de transport ou annulation.
 */
export async function askStream(
  question: string,
  history: HistoryTurn[],
  onEvent: (event: AskEvent) => void,
  signal?: AbortSignal,
  language?: "fr" | "wo",
): Promise<AskResponse> {
  const res = await fetch("/api/ask/stream", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ question, history, language }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Le service a répondu avec une erreur (${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: AskResponse | null = null;
  let errorMessage: string | null = null;

  const handle = (block: string) => {
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("\n");
    if (!data) return;
    let event: AskEvent;
    try {
      event = JSON.parse(data) as AskEvent;
    } catch {
      return;
    }
    onEvent(event);
    if (event.type === "answer") final = event.response;
    if (event.type === "error") errorMessage = event.message;
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.trim()) handle(buffer);

  if (final) return final;
  throw new Error(errorMessage ?? "Le flux s'est terminé sans réponse.");
}
