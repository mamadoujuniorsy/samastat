import Link from "next/link";
import { notFound } from "next/navigation";
import type { IndicatorDetail } from "@/lib/types";
import { BarChart } from "@/components/bar-chart";
import { RegionMap } from "@/components/region-map";
import { CopyButton } from "@/components/copy-button";
import { AppShell } from "@/components/app-shell";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const dynamic = "force-dynamic";

async function loadDetail(id: string): Promise<IndicatorDetail | null | "unavailable"> {
  try {
    const res = await fetch(`${API_URL}/indicators/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (res.status === 404) return null;
    return res.ok ? ((await res.json()) as IndicatorDetail) : "unavailable";
  } catch {
    return "unavailable";
  }
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

function splitUnit(formatted: string, unit: string): [string, string] {
  if (unit === "%") return [formatted.replace(/\s*%$/, ""), "%"];
  const idx = formatted.lastIndexOf(` ${unit}`);
  return idx > 0 ? [formatted.slice(0, idx), unit] : [formatted, ""];
}

/** Fiche partageable d'un enregistrement : chiffre, champ, source, séries, citation. */
export default async function IndicatorPage({ params }: PageProps<"/indicateur/[id]">) {
  const { id } = await params;
  const detail = await loadDetail(id);
  if (detail === null) notFound();

  return (
    <AppShell current="/indicateur">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1 space-y-8">
        {detail === "unavailable" ? (
          <p role="alert" className="text-sm text-text-muted">
            Fiche indisponible : l&apos;API n&apos;a pas répondu.
          </p>
        ) : (
          <Detail detail={detail} />
        )}
      </main>
    </AppShell>
  );
}

function Detail({ detail }: { detail: IndicatorDetail }) {
  const r = detail.record;
  const [num, unit] = splitUnit(r.formattedValue, r.unit);
  const otherRegions = detail.byTerritory.filter((x) => x.territory_level === "region");
  const ids = [...new Set([r.id, ...detail.byPeriod.map((x) => x.id), ...detail.byTerritory.map((x) => x.id)])].join(",");

  return (
    <>
      <nav className="text-xs text-text-muted" aria-label="Fil d'Ariane">
        <Link href="/catalogue" className="underline underline-offset-4 hover:text-text">
          Catalogue
        </Link>{" "}
        · {r.domain}
      </nav>

      <header>
        <p className="text-sm text-text-muted">{r.name}</p>
        <p className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="headline-value">{num}</span>
          <span className="text-base text-text-muted">{unit}</span>
        </p>
        <h1 className="mt-2 text-lg font-medium">
          {r.territory} · {r.period}
        </h1>
        {r.description && <p className="mt-2 max-w-prose text-sm text-text-muted leading-relaxed">{r.description}</p>}
      </header>

      <section className="rounded-lg border border-border bg-surface px-4 py-3 text-sm space-y-1">
        <p>
          <span className="text-text-muted">Champ : </span>
          {r.territory}, {r.period}
        </p>
        <p>
          <span className="text-text-muted">Source : </span>
          <a href={r.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4 decoration-border-strong hover:decoration-text">
            {r.source}
          </a>{" "}
          <span className="text-text-muted">({r.platform})</span>
        </p>
        <p>
          <span className="text-text-muted">Vérifié le : </span>
          {r.verified_at ? dateFormat.format(new Date(r.verified_at)) : "—"}
        </p>
        <p>
          <span className="text-text-muted">Identifiant : </span>
          <code className="font-mono text-xs">{r.id}</code>
        </p>
        <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <CopyButton text={detail.citation} label="Copier la citation" done="Citation copiée" />
          <a className="underline underline-offset-4 decoration-border-strong hover:decoration-text min-h-8 inline-flex items-center" href={`/api/export?ids=${encodeURIComponent(ids)}&format=csv`}>
            CSV des séries
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
        </div>
        <p className="pt-1 text-xs text-text-muted break-words">{detail.citation}</p>
      </section>

      {detail.evolution && (
        <section className="rounded-lg border border-border bg-surface px-4 py-3">
          <BarChart chart={detail.evolution} />
        </section>
      )}

      {detail.comparison && (
        <section className="rounded-lg border border-border bg-surface px-4 py-3 space-y-4">
          <BarChart chart={detail.comparison} />
          {otherRegions.length >= 2 && (
            <RegionMap
              title={detail.comparison.title}
              unit={detail.comparison.unit}
              values={detail.comparison.points.map((p) => ({ territory: p.label, value: p.value, formattedValue: p.formattedValue }))}
            />
          )}
        </section>
      )}

      {detail.byTerritory.length > 1 && (
        <section>
          <h2 className="text-base font-semibold">Même indicateur, autres territoires ({r.period})</h2>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface text-sm">
            {detail.byTerritory.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-4 px-4 py-2">
                <Link href={`/indicateur/${encodeURIComponent(x.id)}`} className={`underline underline-offset-4 decoration-border-strong hover:decoration-text ${x.id === r.id ? "font-medium" : ""}`}>
                  {x.territory}
                </Link>
                <span className="tabular font-medium whitespace-nowrap">{x.formattedValue}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.byPeriod.length > 1 && (
        <section>
          <h2 className="text-base font-semibold">Même indicateur, autres périodes ({r.territory})</h2>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface text-sm">
            {detail.byPeriod.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-4 px-4 py-2">
                <Link href={`/indicateur/${encodeURIComponent(x.id)}`} className={`underline underline-offset-4 decoration-border-strong hover:decoration-text ${x.id === r.id ? "font-medium" : ""}`}>
                  {x.period}
                </Link>
                <span className="tabular font-medium whitespace-nowrap">{x.formattedValue}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm">
        <Link href={`/?q=${encodeURIComponent(`${r.name} ${r.territory} ${r.period}`)}`} className="underline underline-offset-4 decoration-border-strong hover:decoration-text">
          Poser une question à partir de cet indicateur
        </Link>
      </p>
    </>
  );
}
