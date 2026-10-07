"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Exchange, HistoryTurn } from "@/lib/types";
import { askStream } from "@/lib/ask-stream";
import { QuestionForm } from "./question-form";
import { AnswerCard } from "./answer-card";
import { EmptyState } from "./empty-state";

const STORAGE_KEY = "samastat.session.v2";

/** Contexte envoyé à l'API : derniers tours en texte seul. */
function historyOf(exchanges: Exchange[], maxTurns = 8): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
  for (const e of exchanges) {
    if (!e.response || e.response.status === "error") continue;
    turns.push({ role: "user", text: e.question });
    turns.push({ role: "assistant", text: e.response.answer });
  }
  return turns.slice(-maxTurns);
}

/** Historique de session conservé dans le navigateur uniquement (aucun envoi ailleurs). */
function loadSession(): Exchange[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Exchange[]) : [];
    return Array.isArray(parsed) ? parsed.filter((e) => e.response || e.transportError).map((e) => ({ ...e, steps: e.steps ?? [] })) : [];
  } catch {
    return [];
  }
}

function saveSession(exchanges: Exchange[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exchanges.slice(-50)));
  } catch {
    // stockage indisponible : la session reste en mémoire
  }
}

/** Fil de questions/réponses en flux : une seule question en cours à la fois, interruptible. */
export function Chat() {
  const [initialSession] = useState(() => {
    if (typeof window === "undefined") return { exchanges: [] as Exchange[], draft: "" };
    const params = new URLSearchParams(window.location.search);
    const clear = params.get("new") === "1";
    if (clear) window.localStorage.removeItem(STORAGE_KEY);
    const result = { exchanges: clear ? [] : loadSession(), draft: params.get("q") ?? "" };
    if (clear || params.has("q")) window.history.replaceState(null, "", "/");
    return result;
  });
  const [exchanges, setExchanges] = useState<Exchange[]>(initialSession.exchanges);
  const [pending, setPending] = useState(false);
  const [voiceRequestId, setVoiceRequestId] = useState<string | null>(null);
  const [draft, setDraft] = useState(initialSession.draft);
  const [voiceLanguage, setVoiceLanguage] = useState<"auto" | "fr" | "wo">("auto");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveSession(exchanges);
  }, [exchanges]);

  useEffect(() => {
    if (exchanges.length) endRef.current?.scrollIntoView({ block: "end" });
  }, [exchanges]);

  const update = useCallback((id: string, fn: (e: Exchange) => Exchange) => {
    setExchanges((prev) => prev.map((e) => (e.id === id ? fn(e) : e)));
  }, []);

  const ask = useCallback(
    async (question: string, language?: "fr" | "wo", fromVoice = false) => {
      const q = question.trim();
      if (!q || pending) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setVoiceRequestId(fromVoice && language ? id : null);
      const history = historyOf(exchanges);
      setExchanges((prev) => [...prev, { id, question: q, steps: [], ...(fromVoice && language ? { voiceReplyLanguage: language } : {}) }]);
      setDraft("");
      setPending(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await askStream(q, history, () => undefined, controller.signal, language);
        update(id, (e) => ({ ...e, response }));
      } catch (err) {
        if (controller.signal.aborted) {
          update(id, (e) => ({ ...e, aborted: true }));
        } else {
          const message = err instanceof Error ? err.message : "Connexion impossible. Vérifiez votre réseau et réessayez.";
          update(id, (e) => ({ ...e, transportError: message }));
        }
      } finally {
        abortRef.current = null;
        setPending(false);
        inputRef.current?.focus();
      }
    },
    [pending, exchanges, update],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(
    (exchange: Exchange) => {
      setExchanges((prev) => prev.filter((e) => e.id !== exchange.id));
      setTimeout(() => void ask(exchange.question, exchange.voiceReplyLanguage, Boolean(exchange.voiceReplyLanguage)), 0);
    },
    [ask],
  );

  const empty = exchanges.length === 0;
  const form = (
    <QuestionForm
      ref={inputRef}
      value={draft}
      onChange={setDraft}
      onSubmit={(q) => void ask(q)}
      onStop={stop}
      pending={pending}
      language={voiceLanguage}
      onLanguageChange={setVoiceLanguage}
      onTranscribed={(text, language) => void ask(text, language, true)}
      prominent={empty}
    />
  );

  return (
    <main className="flex-1 min-w-0 flex flex-col">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 flex flex-col">
        {empty ? (
          <EmptyState composer={form} onPick={(q) => void ask(q)} />
        ) : (
          <ol className="flex-1 py-8 space-y-12" aria-live="polite" aria-busy={pending}>
            {exchanges.map((e, i) => (
              <li key={e.id} className={`space-y-5 ${i > 0 ? "border-t border-border pt-10" : ""}`}>
                <h2 className="display text-[1.5rem] sm:text-[1.75rem] leading-snug text-balance">{e.question}</h2>
                <AnswerCard exchange={e} pending={pending && !e.response && !e.transportError} onAsk={(q) => void ask(q)} onRetry={() => retry(e)} autoSpeakLanguage={voiceRequestId === e.id ? e.voiceReplyLanguage : undefined} />
              </li>
            ))}
            <li className="flex justify-end">
              <button
                type="button"
                onClick={() => setExchanges([])}
                disabled={pending}
                className="min-h-9 text-xs text-text-muted underline underline-offset-4 hover:text-text disabled:opacity-50"
              >
                Effacer la session de ce navigateur
              </button>
            </li>
            <div ref={endRef} />
          </ol>
        )}
      </div>

      {!empty && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-bg/95 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-3">{form}</div>
        </div>
      )}
    </main>
  );
}
