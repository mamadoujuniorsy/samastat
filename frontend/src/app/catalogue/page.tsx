import Link from "next/link";
import type { CatalogueResponse, IndicatorRecord } from "@/lib/types";
import { AppShell } from "@/components/app-shell";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const dynamic = "force-dynamic";

async function loadCatalogue(params: { domain?: string; level?: string; q?: string }): Promise<CatalogueResponse | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  try {
    const res = await fetch(`${API_URL}/catalogue?${qs.toString()}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    return res.ok ? ((await res.json()) as CatalogueResponse) : null;
  } catch {
    return null;
  }
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Catalogue navigable : tout ce que SamaStat peut citer, avec valeurs, sources et fiches. */
export default async function CataloguePage({ searchParams }: PageProps<"/catalogue">) {
  const params = await searchParams;
  const domain = first(params.domain);
  const level = first(params.level);
  const q = first(params.q);
  const data = await loadCatalogue({ domain, level, q });

  const groups = new Map<string, IndicatorRecord[]>();
  for (const r of data?.records ?? []) {
    const key = `${r.name}|${r.unit}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const linkFor = (next: { domain?: string; level?: string; q?: string }) => {
    const qs = new URLSearchParams();
    const merged = { domain, level, q, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/catalogue?${s}` : "/catalogue";
  };

  return (
    <AppShell current="/catalogue">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1 space-y-6">
        <div>
          <h1 className="display text-[2rem]">Catalogue des indicateurs</h1>
          <p className="mt-2 max-w-prose text-text-muted leading-relaxed">
            Tout ce que SamaStat peut citer. Chaque valeur a été relue sur une publication de l&apos;ANSD ; la fiche
            de chaque indicateur donne ses séries par période et par territoire, et une citation prête à copier.
          </p>
        </div>

        <form method="get" action="/catalogue" className="flex gap-2">
          {domain && <input type="hidden" name="domain" value={domain} />}
          {level && <input type="hidden" name="level" value={level} />}
          <label htmlFor="q" className="sr-only">
            Filtrer le catalogue
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Filtrer : pauvreté, Kaolack, inflation…"
            className="flex-1 min-w-0 min-h-11 rounded-md border border-border-strong bg-surface px-3 text-base placeholder:text-text-muted"
          />
          <button type="submit" className="min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong dark:text-bg">
            Filtrer
          </button>
        </form>

        {data && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FilterChip href={linkFor({ domain: undefined })} active={!domain}>
              Tous les thèmes
            </FilterChip>
            {data.domains.map((d) => (
              <FilterChip key={d.domain} href={linkFor({ domain: d.domain })} active={domain === d.domain}>
                {d.domain} <span className="tabular text-text-muted">{d.count}</span>
              </FilterChip>
            ))}
            <span className="text-text-muted">·</span>
            <FilterChip href={linkFor({ level: undefined })} active={!level}>
              Tous niveaux
            </FilterChip>
            <FilterChip href={linkFor({ level: "national" })} active={level === "national"}>
              National
            </FilterChip>
            <FilterChip href={linkFor({ level: "region" })} active={level === "region"}>
              Régions
            </FilterChip>
            <FilterChip href={linkFor({ level: "departement" })} active={level === "departement"}>
              Départements
            </FilterChip>
            <FilterChip href={linkFor({ level: "commune" })} active={level === "commune"}>
              Communes
            </FilterChip>
          </div>
        )}

        {!data ? (
          <p role="alert" className="text-sm text-text-muted">
            Catalogue indisponible : l&apos;API n&apos;a pas répondu.
          </p>
        ) : groups.size === 0 ? (
          <p className="text-sm text-text-muted">Aucun indicateur ne correspond à ce filtre.</p>
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-text-muted">
              {data.records.length} enregistrement{data.records.length > 1 ? "s" : ""}, {groups.size} indicateur{groups.size > 1 ? "s" : ""}.
            </p>
            {[...groups.entries()].map(([key, rows]) => (
              <section key={key} className="rounded-lg border border-border bg-surface">
                <header className="px-4 py-2.5 border-b border-border flex items-baseline justify-between gap-3">
                  <h2 className="font-medium">{rows[0].name}</h2>
                  <span className="text-xs text-text-muted">
                    {rows[0].domain} · {rows[0].unit}
                  </span>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-text-muted">
                      <tr>
                        <th className="px-4 py-1.5 font-medium">Territoire</th>
                        <th className="px-2 py-1.5 font-medium">Période</th>
                        <th className="px-2 py-1.5 font-medium text-right">Valeur</th>
                        <th className="px-2 py-1.5 font-medium">Source</th>
                        <th className="px-4 py-1.5 font-medium">Vérifié</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="px-4 py-1.5">
                            <Link href={`/indicateur/${encodeURIComponent(r.id)}`} className="underline underline-offset-4 decoration-border-strong hover:decoration-text">
                              {r.territory}
                            </Link>
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{r.period}</td>
                          <td className="px-2 py-1.5 text-right tabular font-medium whitespace-nowrap">{r.formattedValue}</td>
                          <td className="px-2 py-1.5 text-xs text-text-muted max-w-[16rem] truncate" title={r.source}>
                            <a href={r.url} target="_blank" rel="noreferrer noopener" className="hover:underline underline-offset-4">
                              {r.source}
                            </a>
                          </td>
                          <td className="px-4 py-1.5 text-xs text-text-muted whitespace-nowrap">
                            {r.verified_at ? dateFormat.format(new Date(r.verified_at)) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`min-h-9 inline-flex items-center gap-1 rounded-full border px-3 py-1 ${
        active ? "border-accent bg-accent-soft text-text" : "border-border-strong bg-surface hover:bg-surface-muted"
      }`}
    >
      {children}
    </Link>
  );
}
