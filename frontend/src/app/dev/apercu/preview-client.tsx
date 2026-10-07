"use client";

import type { AskResponse, AskStep, Exchange } from "@/lib/types";
import { AnswerCard } from "@/components/answer-card";

export function PreviewClient({ samples, steps }: { samples: { question: string; response?: AskResponse; pending?: boolean }[]; steps: AskStep[] }) {
  const noop = () => undefined;
  return (
    <>
      {samples.map((s, i) => {
        const exchange: Exchange = { id: String(i), question: s.question, steps: s.pending ? steps.slice(0, 3) : steps, response: s.response };
        return (
          <section key={i} className="space-y-4">
            <h2 className="display text-[1.6rem] leading-snug">{s.question}</h2>
            <AnswerCard exchange={exchange} pending={Boolean(s.pending)} onAsk={noop} onRetry={noop} />
          </section>
        );
      })}
    </>
  );
}
