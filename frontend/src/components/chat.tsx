"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const params = useSearchParams();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);
  const [voiceRequestId, setVoiceRequestId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftVoiceLanguage, setDraftVoiceLanguage] = useState<"fr" | "wo" | null>(null);
  const [autoSendVoice, setAutoSendVoice] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<"auto" | "fr" | "wo">("auto");
  const endRef = useRef<HTMLLIElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const restoredRef = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const first = !restoredRef.current;
    const clear = params.get("new") === "1";
    if (!first && !clear && !params.has("q")) return;
    restoredRef.current = true;
    if (first) {
      try { setAutoSendVoice(localStorage.getItem("samastat.voice.autoSend") === "true"); } catch { /* stockage indisponible */ }
    }
    if (clear) {
      abortRef.current?.abort();
      abortRef.current = null;
      setPending(false);
      setVoiceRequestId(null);
    }
    if (first || clear) setExchanges(clear ? [] : loadSession());
    setDraft(params.get("q") ?? "");
    setDraftVoiceLanguage(null);
    setHydrated(true);
    if (clear || params.has("q")) {
      const next = new URLSearchParams(params.toString());
      next.delete("new"); next.delete("q");
      window.history.replaceState(null, "", next.size ? `/?${next}` : "/");
    }
  }, [params]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (hydrated) saveSession(exchanges);
  }, [exchanges, hydrated]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (exchanges.length) endRef.current?.scrollIntoView({ block: "end" });
  }, [exchanges.length]);

  const update = useCallback((id: string, fn: (e: Exchange) => Exchange) => {
    setExchanges((prev) => prev.map((e) => (e.id === id ? fn(e) : e)));
  }, []);

  const ask = useCallback(
    async (question: string, language?: "fr" | "wo", fromVoice = false) => {
      const q = question.trim();
      if (q.length < 2 || pending || abortRef.current) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setVoiceRequestId(fromVoice && language ? id : null);
      const history = historyOf(exchanges);
      setExchanges((prev) => [...prev, { id, question: q, steps: [], ...(fromVoice && language ? { voiceReplyLanguage: language } : {}) }]);
      setDraft("");
      setDraftVoiceLanguage(null);
      setPending(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await askStream(q, history, (event) => {
          if (event.type === "step") update(id, (e) => ({ ...e, steps: [...e.steps, event.step] }));
        }, controller.signal, language);
        if (controller.signal.aborted) return;
        update(id, (e) => ({ ...e, response }));
      } catch (err) {
        if (controller.signal.aborted) {
          update(id, (e) => ({ ...e, aborted: true }));
        } else {
          const message = err instanceof Error ? err.message : "Connexion impossible. Vérifiez votre réseau et réessayez.";
          update(id, (e) => ({ ...e, transportError: message }));
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setPending(false);
          inputRef.current?.focus();
        }
      }
    },
    [pending, exchanges, update],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(
    (exchange: Exchange) => {
      if (pending || abortRef.current) return;
      setExchanges((prev) => prev.filter((e) => e.id !== exchange.id));
      void ask(exchange.question, exchange.voiceReplyLanguage, Boolean(exchange.voiceReplyLanguage));
    },
    [ask, pending],
  );

  const empty = exchanges.length === 0;
  const latestResponse = exchanges.at(-1)?.response;
  const form = (
    <QuestionForm
      ref={inputRef}
      value={draft}
      onChange={(text) => { setDraft(text); if (!text.trim()) setDraftVoiceLanguage(null); }}
      onSubmit={(q) => void ask(q, draftVoiceLanguage ?? undefined, Boolean(draftVoiceLanguage))}
      onStop={stop}
      pending={pending}
      language={voiceLanguage}
      onLanguageChange={setVoiceLanguage}
      onTranscribed={(text, language, autoSendAllowed) => {
        setDraftVoiceLanguage(language);
        if (autoSendVoice && autoSendAllowed) void ask(text, language, true);
      }}
      autoSendVoice={autoSendVoice}
      onAutoSendVoiceChange={(enabled) => {
        setAutoSendVoice(enabled);
        try { localStorage.setItem("samastat.voice.autoSend", String(enabled)); } catch { /* stockage indisponible */ }
      }}
      prominent={empty}
    />
  );

  return (
    <main className="flex-1 min-w-0 flex flex-col">
      <p role="status" aria-atomic="true" className="sr-only">
        {latestResponse ? "Réponse disponible. Retrouvez le résultat et les sources dans la conversation." : ""}
      </p>
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 flex flex-col">
        {empty ? (
          <EmptyState composer={form} onPick={(q) => void ask(q)} />
        ) : (
          <ol className="flex-1 py-8 space-y-12" aria-label="Conversation">
            {exchanges.map((e, i) => (
              <li key={e.id} className={`space-y-5 ${i > 0 ? "border-t border-border pt-10" : ""}`}>
                <h2 className="display text-[1.5rem] sm:text-[1.75rem] leading-snug text-balance">{e.question}</h2>
                <AnswerCard exchange={e} pending={pending && !e.response && !e.transportError && !e.aborted} onAsk={(q) => void ask(q)} onRetry={() => retry(e)} autoSpeakLanguage={voiceRequestId === e.id ? e.voiceReplyLanguage : undefined} />
              </li>
            ))}
            <li className="flex justify-end">
              <button
                type="button"
                onClick={() => setExchanges([])}
                disabled={pending}
                className="min-h-11 text-xs text-text-muted underline underline-offset-4 hover:text-text disabled:opacity-50"
              >
                Effacer la session de ce navigateur
              </button>
            </li>
            <li ref={endRef} aria-hidden="true" />
          </ol>
        )}
      </div>

      {!empty && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-3">{form}</div>
        </div>
      )}
    </main>
  );
}
