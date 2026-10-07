import { notFound } from "next/navigation";
import type { AskResponse, AskStep, CitedRecord, IndicatorDetail } from "@/lib/types";
import { PreviewClient } from "./preview-client";
import { AppShell } from "@/components/app-shell";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const dynamic = "force-dynamic";

/**
 * Aperçu de mise en page, hors production : une réponse composée côté serveur à partir de deux
 * enregistrements réels de la base, avec le même gabarit que le repli de la garde. Aucun appel au modèle.
 */
export default async function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const detail = await fetch(`${API_URL}/indicators/ehcvm2-2021-2022-pauvrete-region-dakar`, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<IndicatorDetail>) : null))
    .catch(() => null);
  if (!detail) {
    return (
      <AppShell current="/">
        <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1 text-sm text-text-muted">API injoignable.</main>
    </AppShell>
  );
  }

  const toCited = (r: IndicatorDetail["record"]): CitedRecord => ({
    indicatorId: r.id,
    name: r.name,
    value: r.value,
    formattedValue: r.formattedValue,
    unit: r.unit,
    territory: r.territory,
    territoryLevel: r.territory_level,
    period: r.period,
    source: r.source,
    platform: r.platform,
    url: r.url,
    domain: r.domain,
    verifiedAt: r.verified_at,
  });

  // Horodatages fixes : l'aperçu n'a pas de notion de temps réel.
  const base = Date.parse("2026-09-19T11:00:00.000Z");
  const at = (ms: number) => new Date(base + ms).toISOString();
  const steps: AskStep[] = [
    { kind: "language", label: "Question en français", at: at(0) },
    { kind: "search", label: "Recherche dans le catalogue : « taux de pauvreté »", detail: "2021-2022", at: at(400) },
    { kind: "search", label: "10 indicateurs candidats", detail: "Taux de pauvreté monétaire · Région de Kédougou · 2021-2022 ; …", at: at(1100) },
    { kind: "fetch", label: `${detail.byTerritory.length} valeurs récupérées en base`, at: at(3900) },
    { kind: "guard", label: "Garde anti-invention : aucun chiffre écrit par le modèle", at: at(5600) },
  ];

  const regions = detail.byTerritory.filter((r) => r.territory_level === "region").sort((a, b) => b.value - a.value);
  const top = regions[0];
  const bottom = regions[regions.length - 1];
  const single: AskResponse = {
    status: "answered",
    question: `Quel est le taux de pauvreté dans la région de Dakar en ${detail.record.period} ?`,
    answer: `Le taux de pauvreté monétaire de la Région de Dakar est de ${detail.record.formattedValue} en ${detail.record.period}, selon l'enquête EHCVM II de l'ANSD.`,
    answerWolof: `Xëtu ndóol gi ci diiwaanu Dakar mooy ${detail.record.formattedValue} ci ${detail.record.period}, ci li EHCVM II bu ANSD wax.`,
    suggestions: [],
    data: [toCited(detail.record)],
    surveys: [],
    chart: null,
    followUps: [
      { kind: "all_regions", label: "Toutes les régions", question: `Compare le taux de pauvreté monétaire de toutes les régions en ${detail.record.period}.` },
      { kind: "compare", label: "Et Thiès ?", question: `Quel est le taux de pauvreté monétaire dans la région de Thiès en ${detail.record.period} ?` },
      { kind: "national", label: "Au niveau national", question: `Quel est le taux de pauvreté monétaire au Sénégal en ${detail.record.period} ?` },
    ],
    meta: { model: "aperçu", retrievedAt: new Date(base + 6000).toISOString(), guard: "passed", violations: [], toolCalls: [], latencyMs: 5600, language: "fr", cached: false, permalink: "apercu42", attribution: "" },
  };

  const comparison: AskResponse = {
    ...single,
    question: `Compare le taux de pauvreté monétaire de toutes les régions en ${detail.record.period}.`,
    answerWolof: null,
    answer: `En ${detail.record.period}, le taux de pauvreté monétaire va de ${bottom.formattedValue} dans la ${bottom.territory} à ${top.formattedValue} dans la ${top.territory}, selon l'enquête EHCVM II de l'ANSD.`,
    data: regions.map(toCited),
    chart: detail.comparison,
    followUps: [{ kind: "national", label: "Au niveau national", question: `Quel est le taux de pauvreté monétaire au Sénégal en ${detail.record.period} ?` }],
  };

  const noData: AskResponse = {
    ...single,
    status: "no_data",
    question: "Quel est le taux de chômage à Dakar ?",
    answerWolof: null,
    answer: "Le taux de chômage n'est pas publié par région dans le catalogue SamaStat : l'enquête emploi donne des valeurs nationales, urbaines et rurales.",
    data: [],
    chart: null,
    followUps: [],
    suggestions: ["Quel est le taux de chômage élargi en milieu urbain au Sénégal en T1 2026 ?", "Quel est le taux de chômage au sens du BIT au Sénégal en T1 2026 ?"],
    surveys: [{ idno: "SEN-ANSD-ENES-T4-2025-V1.0", title: "Enquête nationale sur l'emploi au Sénégal", label: "Enquête nationale sur l'emploi au Sénégal (2025)", yearStart: 2025, yearEnd: 2025, authoringEntity: "ANSD", url: "https://anads.ansd.sn/index.php/catalog/352" }],
  };

  return (
    <AppShell current="/">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1 space-y-12">
        <p className="text-xs text-ochre">Aperçu de mise en page (développement) : réponses composées depuis des enregistrements réels, sans appel au modèle.</p>
        <PreviewClient
          steps={steps}
          samples={[
            { question: single.question, response: single },
            { question: comparison.question, response: comparison },
            { question: noData.question, response: noData },
            { question: 'Question en cours', pending: true },
          ]}
        />
      </main>
    </AppShell>
  );
}
