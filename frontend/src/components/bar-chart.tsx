import type { ChartHint } from "@/lib/types";

/** Barres horizontales proportionnelles : chaque barre est un enregistrement de la base. */
export function BarChart({ chart, compact = false }: { chart: ChartHint; compact?: boolean }) {
  const max = Math.max(...chart.points.map((p) => Math.abs(p.value)), 0);
  const kindLabel = chart.kind === "evolution" ? "Évolution" : "Comparaison";
  return (
    <figure>
      <figcaption className="text-xs text-text-muted">
        {kindLabel} · <span className="font-medium text-text">{chart.title}</span>
        {chart.unit ? <span> · {chart.unit}</span> : null}
      </figcaption>
      <ul className={`mt-2 ${compact ? "space-y-1" : "space-y-1.5"}`}>
        {chart.points.map((p) => {
          const ratio = max > 0 ? Math.abs(p.value) / max : 0;
          return (
            <li key={p.indicatorId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,auto)]">
              <span className="min-w-0 break-words text-xs text-text-muted" title={p.label}>
                {p.label.replace(/^Région de /, "")}
              </span>
              <span className="col-span-2 row-start-2 h-3 rounded-sm bg-surface-muted overflow-hidden sm:col-span-1 sm:row-start-1 sm:col-start-2" aria-hidden="true">
                <span
                  className={`block h-full rounded-sm ${p.value < 0 ? "bg-danger" : "bg-accent"}`}
                  style={{ width: `${ratio * 100}%` }}
                />
              </span>
              <span className="tabular min-w-0 break-words text-right font-medium sm:col-start-3">{p.formattedValue}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-text-muted">Longueur relative à la plus grande valeur absolue ; les valeurs négatives sont signalées par leur signe et en rouge.</p>
    </figure>
  );
}
