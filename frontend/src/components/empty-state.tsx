"use client";

import type { ReactNode } from "react";

interface Props { composer: ReactNode; onPick: (question: string) => void }
const examples = ["Quelle est la population du Sénégal ?", "Comment évolue l’inflation ?", "Ñaata nit ñoo dëkk Sénégal ?"];

export function EmptyState({ composer, onPick }: Props) {
  return <section className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col justify-center px-4 pb-16 pt-16 sm:px-8">
    <h1 className="mb-7 text-center text-2xl font-medium tracking-tight text-balance sm:text-3xl">Que voulez-vous savoir sur le Sénégal ?</h1>
    {composer}
    <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2" aria-label="Exemples de questions">
      {examples.map((q) => <button key={q} type="button" onClick={() => onPick(q)} className="min-h-10 rounded-full border border-white/10 px-4 py-2 text-left text-sm text-white/70 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white">{q}</button>)}
    </div>
  </section>;
}
