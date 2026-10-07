"use client";

import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ForwardedRef, type KeyboardEvent } from "react";
import { IconArrowUp, IconMic, IconSquare } from "./icons";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (question: string) => void;
  onStop: () => void;
  pending: boolean;
  language: "auto" | "fr" | "wo";
  onLanguageChange: (language: "auto" | "fr" | "wo") => void;
  /** Après transcription : le parent envoie la question à l’agent. */
  onTranscribed?: (text: string, language: "fr" | "wo") => void;
  prominent?: boolean;
}

const MAX_LENGTH = 500;
const MAX_HEIGHT_PX = 180;
const MAX_RECORDING_SECONDS = 30;

export const QuestionForm = forwardRef<HTMLTextAreaElement, Props>(function QuestionForm(
  { value, onChange, onSubmit, onStop, pending, language, onLanguageChange, onTranscribed, prominent = false },
  forwardedRef,
) {
  const id = useId();
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const dictationBaseRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscribedRef = useRef(onTranscribed);
  const pendingRef = useRef(pending);
  onTranscribedRef.current = onTranscribed;
  pendingRef.current = pending;
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const canSubmit = value.trim().length >= 2 && !pending && !recording && !transcribing;

  const setRefs = useCallback((el: HTMLTextAreaElement | null) => {
    localRef.current = el;
    assignRef(forwardedRef, el);
  }, [forwardedRef]);

  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      e.preventDefault();
      localRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) onSubmit(value);
    }
  };

  const toggleRecording = async () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    if (transcribing) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceMessage("La dictée nécessite un navigateur récent et une connexion sécurisée (HTTPS).");
      return;
    }

    setVoiceMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      dictationBaseRef.current = value.trim();
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        streamRef.current = null;
        setRecording(false);
        setVoiceMessage("L’enregistrement a échoué. Vérifiez l’autorisation du microphone.");
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 1000) {
          setVoiceMessage("Enregistrement trop court. Parlez quelques secondes, puis réessayez.");
          return;
        }
        if (blob.size > 5 * 1024 * 1024) {
          setVoiceMessage("Enregistrement trop volumineux. Faites une question plus courte.");
          return;
        }

        setTranscribing(true);
        setVoiceMessage("Transcription en cours…");
        try {
          const form = new FormData();
          form.append("audio", blob, `question.${blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"}`);
          form.append("language", language);
          const response = await fetch("/api/wolof/transcribe", { method: "POST", body: form, signal: AbortSignal.timeout(50_000) });
          const data = await response.json() as { text?: string; language?: string; message?: string };
          if (!response.ok || !data.text?.trim()) throw new Error(data.message ?? "Aucune parole reconnue. Réessayez ou saisissez votre question.");
          const recognized = data.text.trim();
          const spokenLang: "fr" | "wo" = data.language === "wo" ? "wo" : "fr";
          const base = dictationBaseRef.current;
          const combined = `${base}${base ? " " : ""}${recognized}`.slice(0, MAX_LENGTH);
          onChange(combined);
          if (onTranscribedRef.current && !pendingRef.current && combined.trim().length >= 2) {
            setVoiceMessage(spokenLang === "wo" ? "Vocal wolof compris — SamaStat répond…" : "Vocal compris — SamaStat répond…");
            onTranscribedRef.current(combined, spokenLang);
          } else {
            localRef.current?.focus();
            setVoiceMessage("Texte reconnu. Relisez-le avant de l’envoyer.");
          }
        } catch (error) {
          setVoiceMessage(error instanceof Error ? error.message : "La transcription a échoué. Réessayez ou saisissez votre question.");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      setRecording(true);
      setVoiceMessage("Enregistrement… appuyez sur le micro pour terminer.");
      timerRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          setRecording(false);
        }
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      setVoiceMessage(denied ? "Autorisez le microphone dans votre navigateur, puis réessayez." : "Impossible d’accéder au microphone. Vérifiez qu’il est connecté et autorisé.");
    }
  };

  return (
    <form className={`border transition-colors focus-within:border-accent ${prominent ? "rounded-3xl border-white/10 bg-surface-muted shadow-card" : "rounded-2xl border-border bg-surface"}`}
      onSubmit={(e) => { e.preventDefault(); if (canSubmit) onSubmit(value); }}>
      <label htmlFor={id} className="sr-only">Votre question sur les statistiques du Sénégal</label>
      <div className="flex items-end gap-2 p-2 pl-4 sm:p-3 sm:pl-5">
        <textarea id={id} ref={setRefs} value={value} onChange={(e) => onChange(e.target.value.slice(0, MAX_LENGTH))} onKeyDown={onKeyDown}
          rows={prominent ? 2 : 1} maxLength={MAX_LENGTH} placeholder={prominent ? "Posez votre question…" : "Poser une autre question"}
          aria-describedby={`${id}-hint`} className={`flex-1 w-full min-w-0 resize-none overflow-y-auto bg-transparent leading-relaxed placeholder:text-text-faint outline-none ${prominent ? "min-h-14 py-2.5 text-[17px]" : "min-h-10 py-2 text-base"}`} />
        <button type="button" onClick={() => void toggleRecording()} disabled={pending || transcribing} aria-label={recording ? "Terminer l’enregistrement" : transcribing ? "Transcription en cours" : "Dicter une question"} aria-pressed={recording}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${recording ? "bg-danger-soft text-danger" : "text-text-muted hover:bg-surface"}`}>
          <IconMic size={19} />
        </button>
        {pending ? <button type="button" onClick={onStop} aria-label="Arrêter la question en cours" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-text hover:bg-surface-muted"><IconSquare size={16} /></button> :
          <button type="submit" disabled={!canSubmit} aria-label="Envoyer la question" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"><IconArrowUp size={18} /></button>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2 sm:px-4">
        <label className="sr-only" htmlFor={`${id}-language`}>Langue de dictée</label>
        <select id={`${id}-language`} value={language} onChange={(e) => {
          const next = e.target.value as "auto" | "fr" | "wo";
          onLanguageChange(next);
          setVoiceMessage(
            next === "wo"
              ? "Dictée wolof (expérimentale) : la question part dès que le vocal est transcrit."
              : next === "fr"
                ? "Dictée français : la question part dès que le vocal est transcrit."
                : "Dictée auto (wolof ou français) : la question part dès que le vocal est transcrit.",
          );
        }} className="min-h-9 max-w-40 rounded-full bg-transparent px-2 text-xs text-text-muted outline-none focus-visible:ring-1 focus-visible:ring-focus">
          <option value="auto">Auto (wo / fr)</option>
          <option value="fr">Français</option>
          <option value="wo">Wolof</option>
        </select>
        <span id={`${id}-hint`} className="ml-auto hidden text-[11px] text-text-faint sm:inline">Entrée pour envoyer</span>
      </div>
      <p aria-live="polite" className={`px-4 pb-2 text-[11px] ${voiceMessage ? "text-text-muted" : "text-text-faint"}`}>{voiceMessage || "Micro : posez la question en wolof ou en français. L’audio est transcrit puis envoyé à l’agent."}</p>
    </form>
  );
});

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
