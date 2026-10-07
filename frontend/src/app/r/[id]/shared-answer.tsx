"use client";

import { useRouter } from "next/navigation";
import type { AskResponse } from "@/lib/types";
import { AnswerCard } from "@/components/answer-card";

export function SharedAnswer({ response }: { response: AskResponse }) {
  const router = useRouter();
  return (
    <AnswerCard
      exchange={{ id: "shared", question: response.question, steps: [], response }}
      pending={false}
      onAsk={(q) => router.push(`/?q=${encodeURIComponent(q)}`)}
      onRetry={() => router.push(`/?q=${encodeURIComponent(response.question)}`)}
    />
  );
}
