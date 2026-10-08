import { MAP_HEIGHT, MAP_WIDTH, SENEGAL_REGIONS } from "@/lib/senegal-regions";

export interface RegionValue {
  /** Nom de région tel qu'il apparaît dans les données (ex. « Région de Dakar »). */
  territory: string;
  value: number;
  formattedValue: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^region de /, "")
    .replace(/[^a-z]/g, "");
}

/** Associe chaque valeur à une région de la carte par nom normalisé. */
export function matchRegions(values: RegionValue[]): Map<string, RegionValue> {
  const out = new Map<string, RegionValue>();
  for (const v of values) {
    const key = normalize(v.territory);
    const region = SENEGAL_REGIONS.find((r) => normalize(r.name) === key);
    if (region) out.set(region.iso, v);
  }
  return out;
}

/**
 * Carte choroplèthe des 14 régions : la teinte est proportionnelle à la valeur,
 * les régions sans valeur restent neutres et sont dites telles. Aucune interpolation.
 */
export function RegionMap({ title, values, unit }: { title: string; values: RegionValue[]; unit: string }) {
  const matched = matchRegions(values);
  if (matched.size < 2) return null;
  const nums = [...matched.values()].map((v) => v.value);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const shade = (v: number) => (max === min ? 0.6 : 0.2 + (0.7 * (v - min)) / (max - min));

  return (
    <figure>
      <figcaption className="text-xs text-text-muted">
        Carte · <span className="font-medium text-text">{title}</span>
        {unit ? <span> · {unit}</span> : null}
      </figcaption>
      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="w-full max-w-md h-auto"
          role="img"
          aria-label={`${title} par région : ${[...matched.values()].map((v) => `${v.territory} ${v.formattedValue}`).join(", ")}`}
        >
          {SENEGAL_REGIONS.map((r) => {
            const v = matched.get(r.iso);
            return (
              <g key={r.iso}>
                <path
                  d={r.path}
                  fill={v ? "var(--accent)" : "var(--surface-muted)"}
                  fillOpacity={v ? shade(v.value) : 1}
                  stroke="var(--border-strong)"
                  strokeWidth={0.8}
                >
                  <title>{v ? `${r.name} : ${v.formattedValue}` : `${r.name} : pas de valeur`}</title>
                </path>
                <text
                  x={r.cx}
                  y={r.cy}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--text)"
                  style={{ paintOrder: "stroke", stroke: "var(--bg)", strokeWidth: 2 }}
                >
                  {r.name}
                </text>
                {v && (
                  <text
                    x={r.cx}
                    y={r.cy + 10}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--text)"
                    style={{ paintOrder: "stroke", stroke: "var(--bg)", strokeWidth: 2, fontVariantNumeric: "tabular-nums" }}
                  >
                    {v.formattedValue}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {matched.size < SENEGAL_REGIONS.length && (
        <p className="mt-1 text-xs text-text-muted">
          {SENEGAL_REGIONS.length - matched.size} région{SENEGAL_REGIONS.length - matched.size > 1 ? "s" : ""} sans
          valeur dans cette réponse (en gris).
        </p>
      )}
      <p className="mt-1 text-xs text-text-muted">Contours : geoBoundaries (CC BY 4.0), simplifiés.</p>
    </figure>
  );
}
