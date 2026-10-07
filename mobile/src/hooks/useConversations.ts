import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, askStream } from '../api';
import { loadConversations, saveConversations } from '../storage';
import type { AskResponse, Conversation, HistoryTurn, Message } from '../types';

/** Contexte envoyé à l'API : texte des derniers tours (questions et réponses rendues). */
export function historyOf(conv: Conversation | null, maxTurns = 8): HistoryTurn[] {
  if (!conv) return [];
  const turns: HistoryTurn[] = [];
  for (const m of conv.messages) {
    if (m.role === 'user') turns.push({ role: 'user', text: m.text });
    else if (m.response && m.response.status !== 'error') turns.push({ role: 'assistant', text: m.response.answer });
  }
  return turns.slice(-maxTurns);
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleFrom(question: string): string {
  const t = question.trim().replace(/\s+/g, ' ');
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
}

/**
 * Gère la liste des conversations, la conversation active et l'envoi d'une question en flux.
 * Une seule question en cours à la fois, interruptible.
 */
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const lastAnswerRef = useRef<((r: AskResponse) => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadConversations().then((list) => {
      if (cancelled) return;
      // Un message resté sans réponse (fermeture de l'app) est marqué interrompu.
      setConversations(
        list.map((c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.role === 'assistant' && !m.response && !m.transportError ? { ...m, aborted: true, steps: m.steps ?? [] } : m,
          ),
        })),
      );
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loaded) void saveConversations(conversations);
  }, [conversations, loaded]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const update = useCallback((id: string, fn: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const newConversation = useCallback(() => setActiveId(null), []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId],
  );

  /** Callback appelé à chaque réponse reçue (utilisé pour la lecture automatique). */
  const onAnswer = useCallback((fn: ((r: AskResponse) => void) | null) => {
    lastAnswerRef.current = fn;
  }, []);

  const send = useCallback(
    async (question: string, language?: 'fr' | 'wo') => {
      const q = question.trim();
      if (!q || pending) return;
      const now = new Date().toISOString();
      const userMsg: Message = { id: newId(), role: 'user', text: q, createdAt: now };
      const assistantMsg: Message = { id: newId(), role: 'assistant', createdAt: now, steps: [] };

      let convId = activeId;
      const current = conversations.find((c) => c.id === convId) ?? null;
      const history = historyOf(current);
      if (!convId || !current) {
        convId = newId();
        const conv: Conversation = {
          id: convId,
          title: titleFrom(q),
          createdAt: now,
          updatedAt: now,
          messages: [userMsg, assistantMsg],
        };
        setConversations((prev) => [conv, ...prev]);
        setActiveId(convId);
      } else {
        update(convId, (c) => ({ ...c, updatedAt: now, messages: [...c.messages, userMsg, assistantMsg] }));
      }

      const patch = (fn: (m: Extract<Message, { role: 'assistant' }>) => Message) =>
        update(convId!, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === assistantMsg.id && m.role === 'assistant' ? fn(m) : m)),
        }));

      setPending(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await askStream(
          q,
          history,
          (event) => {
            if (event.type === 'step') patch((m) => ({ ...m, steps: [...m.steps, event.step] }));
          },
          controller.signal,
          language,
        );
        update(convId, (c) => ({ ...c, updatedAt: new Date().toISOString() }));
        patch((m) => ({ ...m, response }));
        lastAnswerRef.current?.(response);
      } catch (err) {
        if (controller.signal.aborted) {
          patch((m) => ({ ...m, aborted: true }));
        } else {
          const transportError = err instanceof ApiError ? err.message : 'Une erreur inattendue est survenue.';
          patch((m) => ({ ...m, transportError }));
        }
      } finally {
        abortRef.current = null;
        setPending(false);
      }
    },
    [activeId, conversations, pending, update],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** Relance une question interrompue ou en erreur : retire le couple question/réponse puis renvoie. */
  const retry = useCallback(
    (assistantMessageId: string) => {
      const conv = conversations.find((c) => c.id === activeId);
      if (!conv) return;
      const idx = conv.messages.findIndex((m) => m.id === assistantMessageId);
      const userMsg = idx > 0 ? conv.messages[idx - 1] : null;
      if (!userMsg || userMsg.role !== 'user') return;
      update(conv.id, (c) => ({ ...c, messages: c.messages.filter((_, i) => i !== idx && i !== idx - 1) }));
      setTimeout(() => void send(userMsg.text), 0);
    },
    [activeId, conversations, send, update],
  );

  return {
    conversations,
    active,
    loaded,
    pending,
    send,
    stop,
    retry,
    newConversation,
    selectConversation: setActiveId,
    deleteConversation,
    onAnswer,
  };
}
