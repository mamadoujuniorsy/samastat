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
            <li key={p.indicatorId} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-xs text-text-muted" title={p.label}>
                {p.label.replace(/^Région de /, "")}
              </span>
              <span className="h-3 rounded-sm bg-surface-muted overflow-hidden" aria-hidden="true">
                <span
                  className={`block h-full rounded-sm ${p.value < 0 ? "bg-danger" : "bg-accent"}`}
                  style={{ width: `${Math.max(ratio * 100, 1.5)}%` }}
                />
              </span>
              <span className="tabular whitespace-nowrap font-medium">{p.formattedValue}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
