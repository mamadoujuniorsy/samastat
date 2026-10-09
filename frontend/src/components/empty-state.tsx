"use client";

import type { ReactNode } from "react";
import Link from "next/link";

interface Props { composer: ReactNode; onPick: (question: string) => void }
const examples = [
  "Quelle est la population du Sénégal ?",
  "Quel est le taux de chômage au Sénégal ?",
  "Comment évolue l’inflation ?",
  "Ñaata nit ñoo dëkk Sénégal ?",
];

export function EmptyState({ composer, onPick }: Props) {
  return <section className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-3xl flex-col justify-center py-10 sm:py-16">
    <h1 className="mb-3 text-center text-2xl font-medium tracking-tight text-balance sm:text-3xl">Que voulez-vous savoir sur le Sénégal ?</h1>
    <p className="mx-auto mb-7 max-w-xl text-center text-sm leading-relaxed text-text-muted">Explorez les statistiques ANSD disponibles dans notre catalogue, en français ou en wolof. Chaque valeur est accompagnée de sa source.</p>
    {composer}
    <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2" aria-label="Exemples de questions">
      {examples.map((q) => <button key={q} type="button" onClick={() => onPick(q)} className="min-h-11 rounded-full border border-border px-4 py-2 text-left text-sm text-text-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-text">{q}</button>)}
    </div>
    <nav className="mt-5 flex flex-wrap justify-center gap-x-6 text-sm" aria-label="Explorer SamaStat">
      <Link href="/catalogue" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">Catalogue des données</Link>
      <Link href="/methode" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">Méthode et sources</Link>
    </nav>
  </section>;
}
