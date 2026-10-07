"use client";

import type { AskStep } from "@/lib/types";

const KIND_LABEL: Record<AskStep["kind"], string> = {
  language: "Langue",
  translate: "Traduction",
  fallback: "Modèle",
  cache: "Cache",
  search: "Recherche",
  fetch: "Base",
  surveys: "ANADS",
  no_data: "Absence",
  compose: "Rédaction",
  guard: "Garde",
};

/**
 * Étapes réelles du traitement, envoyées par le serveur. Pendant l'attente : liste ouverte avec l'étape
 * en cours. Une fois la réponse arrivée : repliée en « n étapes », consultable.
 */
export function StepsPanel({ steps, live }: { steps: AskStep[]; live: boolean }) {
  if (!steps.length) {
    return live ? (
      <p className="text-sm text-text-muted" aria-live="polite">
        Connexion au service…
      </p>
    ) : null;
  }
  const first = new Date(steps[0].at).getTime();

  const list = (
    <ol className="mt-1 space-y-1 text-xs">
      {steps.map((s, i) => {
        const dt = Math.max(0, new Date(s.at).getTime() - first) / 1000;
        const current = live && i === steps.length - 1;
        return (
          <li key={`${s.at}-${i}`} className="grid grid-cols-[4.5rem_1fr_auto] gap-2 items-baseline">
            <span className="text-text-muted">{KIND_LABEL[s.kind]}</span>
            <span className={current ? "text-text" : "text-text-muted"}>
              {s.label}
              {s.detail && <span className="block text-[11px] text-text-muted truncate" title={s.detail}>{s.detail}</span>}
            </span>
            <span className="tabular text-text-muted">{dt.toFixed(1)} s</span>
          </li>
        );
      })}
    </ol>
  );

  if (live) {
    return (
      <div className="text-sm" aria-live="polite" aria-busy="true">
        <p className="text-text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-accent align-middle mr-2 animate-pulse" aria-hidden="true" />
          {steps[steps.length - 1].label}
        </p>
        {list}
      </div>
    );
  }

  return (
    <details className="text-sm group">
      <summary className="text-xs text-text-muted hover:text-text inline-flex items-center gap-1 min-h-8">
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
        {steps.length} étape{steps.length > 1 ? "s" : ""} de traitement
      </summary>
      {list}
    </details>
  );
}
