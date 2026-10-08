import { redirect } from "next/navigation";
import type { UsageStats } from "@/lib/types";
import { staffFetch } from "@/lib/staff-session";
import { RegionMap } from "@/components/region-map";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  answered: "Répondues avec une valeur",
  no_data: "Donnée absente du catalogue",
  conversation: "Hors statistique (salutations, aide)",
  error: "Erreurs de service",
};

const LANGUAGE_LABELS: Record<string, string> = { fr: "Français", wo: "Wolof", unknown: "Indéterminée" };

const numberFormat = new Intl.NumberFormat("fr-FR");

function BarList({ rows, label }: { rows: { key: string; label: string; count: number }[]; label: string }) {
  const max = Math.max(...rows.map((r) => r.count), 0);
  if (!rows.length) return <p className="mt-2 text-sm text-text-muted">Aucune donnée sur la période.</p>;
  return (
    <ul className="mt-2 space-y-1.5 text-sm" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_minmax(3rem,1.4fr)_auto] items-center gap-2 sm:gap-3">
          <span className="min-w-0 break-words text-text-muted" title={r.label}>
            {r.label}
          </span>
          <span className="h-3 rounded bg-surface-muted overflow-hidden" aria-hidden="true">
            <span className="block h-full rounded bg-accent" style={{ width: `${max ? Math.max((100 * r.count) / max, 2) : 0}%` }} />
          </span>
          <span className="tabular font-medium">{numberFormat.format(r.count)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Tableau de bord d'usage destiné à l'ANSD (livrable 6) : uniquement des agrégats anonymes.
 * Indicateurs demandés, questions sans réponse, répartition thématique, géographique et linguistique.
 */
export default async function UsagePage({ searchParams }: PageProps<"/usage">) {
  const params = await searchParams;
  const daysParam = Array.isArray(params.days) ? params.days[0] : params.days;
  const days = Math.min(Math.max(Number(daysParam) || 30, 1), 365);
  const loaded = await staffFetch<UsageStats>(`/stats?days=${days}`);
  if (loaded === "unauthorized") redirect("/connexion");
  const stats = loaded;

  const regionValues =
    stats?.byTerritory
      .filter((t) => t.level === "region")
      .map((t) => ({ territory: t.territory, value: t.count, formattedValue: numberFormat.format(t.count) })) ?? [];

  return (
    <AppShell current="/usage">

      <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-8 flex-1 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div><p className="rule text-xs font-medium tracking-wide text-text-faint">Espace ANSD</p><h1 className="display text-[2rem]">Tableau de bord d&apos;usage</h1></div>
          <nav className="text-sm text-text-muted flex gap-3" aria-label="Fenêtre d'analyse">
            {[7, 30, 90].map((d) => (
              <a
                key={d}
                href={`/usage?days=${d}`}
                aria-current={d === days ? "page" : undefined}
                className={`underline underline-offset-4 ${d === days ? "text-text" : "hover:text-text"}`}
              >
                {d} jours
              </a>
            ))}
          </nav>
        </div>
        <p className="text-sm text-text-muted max-w-prose">
          Les événements enregistrés ne sont pas reliés à un compte utilisateur. Les questions sont toutefois conservées pour produire ces agrégats et repérer les besoins non couverts. Évitez de saisir des informations personnelles. Les thèmes et territoires ci-dessous proviennent des indicateurs cités dans les réponses, pas de toutes les demandes.
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a className="underline underline-offset-4 decoration-border-strong hover:decoration-text" href={`/api/stats/questions.csv?days=${days}`}>Exporter toutes les questions (CSV)</a>
          <a className="underline underline-offset-4 decoration-border-strong hover:decoration-text" href={`/api/stats/questions.csv?days=${days}&status=no_data`}>Exporter les questions sans réponse (CSV)</a>
        </div>

        {!stats ? (
          <p role="alert" className="text-sm text-text-muted">
            Statistiques indisponibles : l&apos;API n&apos;a pas répondu.
          </p>
        ) : stats.total === 0 ? (
          <p className="text-sm text-text-muted">Aucune question posée sur les {days} derniers jours.</p>
        ) : (
          <>
            <section>
              <h2 className="text-xl font-semibold tracking-tight">
                Activité sur les {days} derniers jours
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Questions reçues", value: stats.total },
                  { label: "Réponses avec valeur", value: stats.byStatus.answered ?? 0 },
                  { label: "À étudier pour le catalogue", value: stats.byStatus.no_data ?? 0 },
                  { label: "Réponses servies du cache", value: stats.cachedAnswers },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-border bg-surface p-5">
                    <dt className="text-xs leading-snug text-text-muted">{metric.label}</dt>
                    <dd className="display mt-2 text-3xl tabular">{numberFormat.format(metric.value)}</dd>
                  </div>
                ))}
              </div>
              <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 text-sm">
                {Object.entries(stats.byStatus).map(([status, n]) => (
                  <div key={status} className="flex justify-between gap-4 border-b border-border py-1.5">
                    <dt className="text-text-muted">{STATUS_LABELS[status] ?? status}</dt>
                    <dd className="tabular font-medium">{numberFormat.format(n)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-b border-border py-1.5">
                  <dt className="text-text-muted">Garde anti-invention déclenchée</dt>
                  <dd className="tabular font-medium">{numberFormat.format(stats.guardFallbacks)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border py-1.5">
                  <dt className="text-text-muted">Réponses servies depuis le cache</dt>
                  <dd className="tabular font-medium">{numberFormat.format(stats.cachedAnswers)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border py-1.5">
                  <dt className="text-text-muted">Latence moyenne (hors cache)</dt>
                  <dd className="tabular font-medium">
                    {stats.avgLatencyMs != null ? `${(stats.avgLatencyMs / 1000).toFixed(1)} s` : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="grid gap-8 sm:grid-cols-2">
              <div>
                <h2 className="text-base font-semibold">Langue des questions</h2>
                <BarList
                  label="Répartition linguistique"
                  rows={Object.entries(stats.byLanguage).map(([k, n]) => ({ key: k, label: LANGUAGE_LABELS[k] ?? k, count: n }))}
                />
              </div>
              <div>
                <h2 className="text-base font-semibold">Thèmes des indicateurs cités</h2>
                <BarList label="Répartition thématique" rows={stats.byDomain.map((d) => ({ key: d.domain, label: d.domain, count: d.count }))} />
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold">Territoires des indicateurs cités</h2>
              <p className="mt-1 text-sm text-text-muted">Questions associées à au moins un indicateur de ce territoire. Les demandes sans indicateur lié ne figurent pas dans cette vue.</p>
              {regionValues.length >= 2 && (
                <div className="mt-3">
                  <RegionMap title="Questions par région" unit="questions" values={regionValues} />
                </div>
              )}
              <BarList
                label="Répartition géographique"
                rows={stats.byTerritory.map((t) => ({ key: `${t.level}-${t.territory}`, label: t.territory, count: t.count }))}
              />
            </section>

            <section>
              <h2 className="text-base font-semibold">Questions par jour</h2>
              <div className="overflow-x-auto">
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs text-text-muted">
                    <tr>
                      <th className="py-1 font-medium">Jour</th>
                      <th className="py-1 font-medium text-right">Questions</th>
                      <th className="py-1 font-medium text-right">Avec valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.perDay.map((d) => (
                      <tr key={d.day} className="border-t border-border">
                        <td className="py-1">{d.day}</td>
                        <td className="py-1 text-right tabular">{d.total}</td>
                        <td className="py-1 text-right tabular">{d.answered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold">Questions les plus fréquentes</h2>
              <p className="mt-1 text-sm text-text-muted">Regroupées après normalisation (minuscules, espaces), avec le statut le plus fréquent.</p>
              {stats.topQuestions.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">Aucune sur la période.</p>
              ) : (
                <ol className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface text-sm">
                  {stats.topQuestions.map((q) => (
                    <li key={q.question} className="flex items-center justify-between gap-4 px-4 py-2">
                      <span className="min-w-0">
                        <span className="block">{q.question}</span>
                        <span className="text-xs text-text-muted">{STATUS_LABELS[q.status] ?? q.status}</span>
                      </span>
                      <span className="tabular text-text-muted">{q.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section>
              <h2 className="text-base font-semibold">Questions restées sans donnée</h2>
              <p className="mt-1 text-sm text-text-muted">
                À examiner pour enrichir le catalogue ou orienter la programmation statistique.
              </p>
              {stats.unansweredQuestions.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">Aucune sur la période.</p>
              ) : (
                <ol className="mt-2 divide-y divide-border text-sm">
                  {stats.unansweredQuestions.map((q) => (
                    <li key={q.question} className="flex justify-between gap-4 py-1.5">
                      <span>{q.question}</span>
                      <span className="tabular text-text-muted">{q.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section>
              <h2 className="text-base font-semibold">Indicateurs les plus mobilisés</h2>
              {stats.topIndicators.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">Aucun sur la période.</p>
              ) : (
                <ol className="mt-2 divide-y divide-border text-sm">
                  {stats.topIndicators.map((i) => (
                    <li key={i.indicatorId} className="flex justify-between gap-4 py-1.5">
                      <span>
                        {i.name ?? i.indicatorId}
                        {i.territory && <span className="text-text-muted"> · {i.territory}</span>}
                        <span className="text-text-muted"> · </span>
                        <code className="font-mono text-xs text-text-muted">{i.indicatorId}</code>
                      </span>
                      <span className="tabular text-text-muted">{i.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
