import Link from "next/link";
import { notFound } from "next/navigation";
import type { AskResponse } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { SharedAnswer } from "./shared-answer";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const dynamic = "force-dynamic";

async function load(id: string): Promise<{ response: AskResponse; createdAt: string } | null | "unavailable"> {
  try {
    const res = await fetch(`${API_URL}/answers/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (res.status === 404) return null;
    return res.ok ? ((await res.json()) as { response: AskResponse; createdAt: string }) : "unavailable";
  } catch {
    return "unavailable";
  }
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** Page permanente d'une réponse : lisible sans compte, citable, avec ses sources. */
export default async function SharedAnswerPage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const data = await load(id);
  if (data === null) notFound();

  return (
    <AppShell current="/">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1 space-y-6">
        {data === "unavailable" ? (
          <p role="alert" className="text-sm text-text-muted">
            Réponse indisponible : l&apos;API n&apos;a pas répondu.
          </p>
        ) : (
          <>
            <p className="text-xs text-text-muted">
              Réponse SamaStat enregistrée le {dateFormat.format(new Date(data.createdAt))} · lien permanent{" "}
              <code className="font-mono">/r/{id}</code>
            </p>
            <h1 className="display text-[1.75rem] leading-snug">{data.response.question}</h1>
            <SharedAnswer response={data.response} />
            <p className="text-sm">
              <Link href={`/?q=${encodeURIComponent(data.response.question)}`} className="underline underline-offset-4 decoration-border-strong hover:decoration-text">
                Poser la même question maintenant
              </Link>
            </p>
          </>
        )}
      </main>
    </AppShell>
  );
}
