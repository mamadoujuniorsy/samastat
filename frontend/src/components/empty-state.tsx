"use client";

import type { ReactNode } from "react";

interface Props { composer: ReactNode; onPick: (question: string) => void }

const categories = [
  {
    icon: "👥",
    title: "Population",
    questions: [
      "Quelle est la population du Sénégal ?",
      "Ñaata nit ñoo dëkk Ndakaaru ?",
    ],
  },
  {
    icon: "📊",
    title: "Économie",
    questions: [
      "Quel est le taux de chômage ?",
      "Comment évolue l'inflation ?",
    ],
  },
  {
    icon: "🏥",
    title: "Social",
    questions: [
      "Quelle est l'espérance de vie ?",
      "Taux de scolarisation au Sénégal ?",
    ],
  },
];

export function EmptyState({ composer, onPick }: Props) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-8 pt-8 sm:px-8">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-ochre/20 text-3xl shadow-lg ring-1 ring-white/10">
          🇸🇳
        </div>
        <h1 className="bg-gradient-to-r from-accent via-text to-ochre bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
          SamaStat
        </h1>
        <p className="mt-2 text-sm text-text-muted sm:text-base">
          Les statistiques officielles du Sénégal, en français et en wolof
        </p>
      </div>

      {/* Composer */}
      <div className="w-full max-w-2xl">{composer}</div>

      {/* Category cards */}
      <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
        {categories.map((cat) => (
          <div
            key={cat.title}
            className="group rounded-2xl border border-border/60 bg-surface/50 p-4 backdrop-blur transition-all duration-200 hover:border-accent/30 hover:bg-surface hover:shadow-card"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">{cat.icon}</span>
              <span className="text-sm font-medium text-text-muted">{cat.title}</span>
            </div>
            <div className="space-y-2">
              {cat.questions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onPick(q)}
                  className="block w-full rounded-xl px-3 py-2 text-left text-[13px] leading-snug text-text-muted transition-all duration-150 hover:bg-accent/8 hover:text-text"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <p className="mt-6 text-center text-[11px] text-text-faint">
        🎙️ Appuyez sur le micro pour poser votre question en wolof ou en français
      </p>
    </section>
  );
}
