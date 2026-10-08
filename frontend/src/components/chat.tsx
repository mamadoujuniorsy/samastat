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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveSession(exchanges);
  }, [exchanges]);

  /* Auto-scroll : on scroll tout en bas à chaque changement d'échanges. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el && exchanges.length) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    }
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
    <main className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden pt-14">
      {empty ? (
        <EmptyState composer={form} onPick={(q) => void ask(q)} />
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Scrollable message area */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6">
              {exchanges.map((e, i) => (
                <div key={e.id} className={i > 0 ? "mt-8" : ""}>
                  {/* User message bubble */}
                  <div className="flex justify-end mb-4">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent/10 px-4 py-3 text-[15px] leading-relaxed ring-1 ring-accent/15">
                      {e.question}
                    </div>
                  </div>

                  {/* Assistant response */}
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-ochre/20 text-sm ring-1 ring-white/10">
                      🇸🇳
                    </div>
                    <div className="min-w-0 flex-1 space-y-4">
                      <AnswerCard
                        exchange={e}
                        pending={pending && !e.response && !e.transportError}
                        onAsk={(q) => void ask(q)}
                        onRetry={() => retry(e)}
                        autoSpeakLanguage={voiceRequestId === e.id ? e.voiceReplyLanguage : undefined}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Session controls */}
              {exchanges.length > 0 && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setExchanges([])}
                    disabled={pending}
                    className="min-h-9 rounded-full border border-border px-4 py-1.5 text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text disabled:opacity-50"
                  >
                    Nouvelle conversation
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Fixed input bar at bottom */}
          <div className="shrink-0 border-t border-border/50 bg-bg/80 backdrop-blur-xl">
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-3">{form}</div>
          </div>
        </div>
      )}
    </main>
  );
}
