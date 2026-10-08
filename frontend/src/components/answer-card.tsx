"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CitedRecord, Exchange } from "@/lib/types";
import { citationFor, copyText, shareOrCopy, shareText, speak } from "@/lib/actions";
import { BarChart } from "./bar-chart";
import { RegionMap } from "./region-map";
import { IconArrowRight } from "./icons";

interface Props {
  exchange: Exchange;
  pending: boolean;
  onAsk: (question: string) => void;
  onRetry: () => void;
  autoSpeakLanguage?: "fr" | "wo";
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

export function AnswerCard({ exchange, pending, onAsk, onRetry, autoSpeakLanguage }: Props) {
  const { response, transportError, aborted } = exchange;

  if (aborted) {
    return (
      <div className="text-sm text-text-muted">
        <p>Question interrompue avant la réponse.</p>
        <button type="button" onClick={onRetry} className="mt-1 underline underline-offset-4 hover:text-text min-h-9">
          Relancer
        </button>
      </div>
    );
  }

  if (transportError) {
    return (
      <div role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm space-y-1">
        <p className="font-medium text-danger">La réponse n&apos;a pas pu être obtenue</p>
        <p>{transportError}</p>
        <p>
          <button type="button" onClick={onRetry} className="underline underline-offset-4 min-h-9">
            Réessayer
          </button>
        </p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex min-h-10 items-center gap-2.5 text-sm text-text-muted" role="status" aria-live="polite" aria-busy={pending}>
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.24s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.12s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" />
        </span>
        <span>{pending ? "SamaStat prépare une réponse…" : "Connexion au service…"}</span>
      </div>
    );
  }

  if (response.status === "error") {
    return (
      <div role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm space-y-1">
        <p className="font-medium text-danger">Le service n&apos;a pas pu répondre</p>
        <p>{response.answer}</p>
        <p>
          <button type="button" onClick={onRetry} className="underline underline-offset-4 min-h-9">
            Réessayer
          </button>
        </p>
      </div>
    );
  }

  const single = response.status === "answered" && response.data.length === 1 ? response.data[0] : null;

  return (
    <article className="space-y-5" aria-label="Réponse de SamaStat">
      {single && <Headline record={single} />}

      {response.answerWolof ? (
        <div className="space-y-3">
          {response.meta.language === "wo" ? (
            <>
              <p className="text-base font-medium leading-relaxed whitespace-pre-wrap" lang="wo">
                {response.answerWolof}
              </p>
              <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-3 space-y-1">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Version française</span>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-text-muted" lang="fr">
                  {response.answer}
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-[17px] leading-relaxed whitespace-pre-wrap" lang="fr">
                {response.answer}
              </p>
              <div className="rounded-xl border border-border/60 bg-surface-muted/40 p-3 space-y-1">
                <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">Traduction wolof (ANSD)</span>
                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap text-text" lang="wo">
                  {response.answerWolof}
                </p>
              </div>
            </>
          )}
          <p className="text-xs text-text-muted">
            Wolof produit par traduction automatique locale (NLLB-200) ; les valeurs, périodes et sources ne passent pas par le traducteur.
          </p>
        </div>
      ) : (
        <p className="text-[17px] leading-relaxed whitespace-pre-wrap">{response.answer}</p>
      )}

      <VoiceResponse response={response} autoSpeakLanguage={autoSpeakLanguage} />

      {response.status === "no_data" && (
        <div className="rounded-lg bg-surface-muted px-4 py-3 text-sm space-y-1">
          <p className="font-medium">Cette donnée n&apos;est pas dans le catalogue SamaStat.</p>
          <p className="text-text-muted">
            Le système ne propose jamais d&apos;estimation à la place d&apos;une valeur officielle.
          </p>
          {response.suggestions.length > 0 && (
            <>
              <p className="pt-1">Le catalogue peut répondre à :</p>
              <ul className="flex flex-wrap gap-2 pt-1">
                {response.suggestions.map((s) => (
                  <li key={s}>
                    <Chip onClick={() => onAsk(s)} disabled={pending}>
                      {s}
                    </Chip>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {response.chart && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 space-y-4">
          <BarChart chart={response.chart} />
          {response.chart.kind === "comparison" && (
            <RegionMap
              title={response.chart.title}
              unit={response.chart.unit}
              values={response.chart.points.map((p) => ({ territory: p.label, value: p.value, formattedValue: p.formattedValue }))}
            />
          )}
        </div>
      )}

      {response.data.length > 0 && (
        <details className="rounded-lg border border-border bg-surface group">
          <summary className="cursor-pointer px-4 py-2.5 text-sm text-text-muted hover:text-text flex items-center gap-2 min-h-11">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
            Voir les sources ANSD ({response.data.length})
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {response.data.map((d) => (
              <SourceRow key={d.indicatorId} record={d} />
            ))}
          </ul>
        </details>
      )}

      {response.surveys.length > 0 && (
        <details className="rounded-lg border border-border bg-surface group">
          <summary className="cursor-pointer px-4 py-2.5 text-sm text-text-muted hover:text-text flex items-center gap-2 min-h-11">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
            Enquêtes ANSD liées ({response.surveys.length})
          </summary>
          <ul className="mt-1.5 space-y-1 border-t border-border px-4 py-3 text-sm">
            {response.surveys.map((s) => (
              <li key={s.idno}>
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4 decoration-border-strong hover:decoration-text">
                  {s.label}
                </a>
                {s.authoringEntity && <span className="text-text-muted"> · {s.authoringEntity}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {response.status !== "conversation" && <Actions response={response} />}

      {response.followUps.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Suites possibles">
          {response.followUps.map((f) => (
            <li key={f.question}>
              <Chip onClick={() => onAsk(f.question)} disabled={pending} title={f.question}>
                {f.label}
              </Chip>
            </li>
          ))}
        </ul>
      )}

    </article>
  );
}

/** Chiffre-vedette : la valeur domine, l'unité et le champ suivent. */
function Headline({ record }: { record: CitedRecord }) {
  const [num, unit] = splitUnit(record.formattedValue, record.unit);
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4 shadow-card">
      <p className="text-sm text-text-muted">{record.name}</p>
      <p className="mt-2 flex items-baseline gap-2 flex-wrap">
        <span className="headline-value">{num}</span>
        <span className="text-lg text-text-muted">{unit}</span>
      </p>
      <p className="mt-2 text-sm text-text-muted">
        Champ : {record.territory} · {record.period}
      </p>
    </div>
  );
}

function splitUnit(formatted: string, unit: string): [string, string] {
  if (unit === "%") return [formatted.replace(/\s*%$/, ""), "%"];
  const idx = formatted.lastIndexOf(` ${unit}`);
  return idx > 0 ? [formatted.slice(0, idx), unit] : [formatted, ""];
}

function SourceRow({ record }: { record: CitedRecord }) {
  return (
    <li className="px-4 py-3 grid gap-x-4 gap-y-1 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          <Link href={`/indicateur/${encodeURIComponent(record.indicatorId)}`} className="hover:underline underline-offset-4">
            {record.name}
          </Link>
          <span className="font-normal text-text-muted">
            {" "}
            · {record.territory} · {record.period}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          Source : {record.source}
          {record.verifiedAt && <> · vérifié le {dateFormat.format(new Date(record.verifiedAt))}</>}
        </p>
        <p className="mt-0.5 text-xs">
          <a href={record.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4 decoration-border-strong hover:decoration-text">
            Page d&apos;origine ({record.platform})
          </a>
          <span className="text-text-muted"> · </span>
          <Link href={`/indicateur/${encodeURIComponent(record.indicatorId)}`} className="underline underline-offset-4 decoration-border-strong hover:decoration-text">
            Fiche et séries
          </Link>
          <span className="text-text-muted"> · </span>
          <code className="font-mono text-[11px] text-text-muted">{record.indicatorId}</code>
        </p>
      </div>
      <p className="tabular text-base font-medium sm:text-right whitespace-nowrap">{record.formattedValue}</p>
    </li>
  );
}

function Chip({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="min-h-9 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm hover:border-border-strong hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
      <IconArrowRight size={13} />
    </button>
  );
}

function Actions({ response }: { response: Exchange["response"] & object }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const ids = response.data.map((d) => d.indicatorId).join(",");

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 1800);
    return () => clearTimeout(t);
  }, [feedback]);

  const say = (msg: string) => setFeedback(msg);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" role="group" aria-label="Actions sur la réponse">
      <ActionButton label="Copier" onClick={async () => say((await copyText(shareText(response))) ? "Réponse copiée" : "Copie impossible")} />
      {response.data.length > 0 && (
        <ActionButton
          label="Citer"
          onClick={async () =>
            say((await copyText(response.data.map((d) => citationFor(d)).join("\n"))) ? "Citation copiée" : "Copie impossible")
          }
        />
      )}
      <ActionButton
        label="Partager"
        onClick={async () => {
          const r = await shareOrCopy("Réponse SamaStat", shareText(response));
          say(r === "shared" ? "Partagé" : r === "copied" ? "Texte copié pour partage" : "Partage impossible");
        }}
      />
      {response.data.length > 0 && (
        <>
          <a className="underline underline-offset-4 decoration-border-strong hover:decoration-text min-h-8 inline-flex items-center" href={`/api/export?ids=${encodeURIComponent(ids)}&format=csv`}>
            CSV
          </a>
          <a className="underline underline-offset-4 decoration-border-strong hover:decoration-text min-h-8 inline-flex items-center" href={`/api/export?ids=${encodeURIComponent(ids)}&format=json`}>
            JSON
          </a>
          <a
            className="underline underline-offset-4 decoration-border-strong hover:decoration-text min-h-8 inline-flex items-center"
            href={`/api/export?ids=${encodeURIComponent(ids)}&format=sdmx`}
            title="Format d'échange des instituts nationaux de statistique (SDMX-JSON 2.0, profil simplifié)"
          >
            SDMX
          </a>
        </>
      )}
      <span role="status" aria-live="polite" className="text-text-muted">
        {feedback}
      </span>
    </div>
  );
}

/** Lecture de la réponse dans la langue demandée à l'oral. */
function VoiceResponse({ response, autoSpeakLanguage }: { response: Exchange["response"] & object; autoSpeakLanguage?: "fr" | "wo" }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [activeLang, setActiveLang] = useState<"fr" | "wo" | null>(null);
  const [message, setMessage] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechStopRef = useRef<(() => void) | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    speechStopRef.current?.();
    speechStopRef.current = null;
    setState("idle");
    setActiveLang(null);
  }, []);

  const play = useCallback(async (language: "fr" | "wo") => {
    audioRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    speechStopRef.current?.();
    abortRef.current?.abort();
    setMessage("");
    setState("loading");
    setActiveLang(language);

    if (language === "wo") {
      if (!response.answerWolof) {
        setState("error");
        setActiveLang(null);
        setMessage("Réponse vocale wolof indisponible pour cette réponse.");
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/wolof/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: response.answerWolof }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Voix wolof indisponible sur ce serveur. Activez SAMASTAT_WOLOF_TTS=1.");
        const url = URL.createObjectURL(await res.blob());
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setState("idle"); setActiveLang(null); URL.revokeObjectURL(url); objectUrlRef.current = null; audioRef.current = null; };
        audio.onerror = () => { setState("error"); setActiveLang(null); setMessage("La lecture audio a échoué."); URL.revokeObjectURL(url); objectUrlRef.current = null; };
        await audio.play();
        setState("playing");
      } catch (error) {
        if (controller.signal.aborted) return;
        setState("error");
        setActiveLang(null);
        setMessage(error instanceof Error ? error.message : "Synthèse vocale indisponible.");
      }
      return;
    }

    const cancel = speak(response.answer, () => { setState("idle"); setActiveLang(null); }, "fr-FR");
    if (!cancel) {
      setState("error");
      setActiveLang(null);
      setMessage("La synthèse vocale française n’est pas disponible dans ce navigateur.");
      return;
    }
    speechStopRef.current = cancel;
    setState("playing");
  }, [response.answer, response.answerWolof]);

  useEffect(() => {
    if (!autoSpeakLanguage) return;
    // Différé d'un cycle pour respecter l'activation du composant après la réponse SSE.
    const timer = setTimeout(() => void play(autoSpeakLanguage), 0);
    return () => { clearTimeout(timer); stop(); };
  }, [autoSpeakLanguage, play, stop]);

  useEffect(() => () => stop(), [stop]);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5">
      {response.answerWolof ? (
        <>
          <ActionButton
            label={
              state === "loading" && activeLang === "wo"
                ? "Préparation voix wolof…"
                : state === "playing" && activeLang === "wo"
                  ? "Arrêter la voix wolof"
                  : "Écouter en wolof"
            }
            onClick={() => {
              if (state === "playing" && activeLang === "wo") stop();
              else void play("wo");
            }}
            active={state === "playing" && activeLang === "wo"}
          />
          <span className="text-text-muted/40 select-none" aria-hidden="true">·</span>
          <ActionButton
            label={
              state === "loading" && activeLang === "fr"
                ? "Préparation voix française…"
                : state === "playing" && activeLang === "fr"
                  ? "Arrêter la voix française"
                  : "Écouter en français"
            }
            onClick={() => {
              if (state === "playing" && activeLang === "fr") stop();
              else void play("fr");
            }}
            active={state === "playing" && activeLang === "fr"}
          />
        </>
      ) : (
        <ActionButton
          label={state === "loading" ? "Préparation de la voix…" : state === "playing" ? "Arrêter la lecture" : "Écouter la réponse"}
          onClick={() => {
            if (state === "playing") stop();
            else void play("fr");
          }}
          active={state === "playing"}
        />
      )}
      {state === "loading" && <span className="sr-only" role="status" aria-live="polite">Préparation de la réponse vocale</span>}
      {message && <span className="text-xs text-text-muted" role="status">{message}</span>}
    </span>
  );
}

function ActionButton({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-8 underline underline-offset-4 decoration-border-strong hover:decoration-text ${active ? "text-accent" : ""}`}
    >
      {label}
    </button>
  );
}
