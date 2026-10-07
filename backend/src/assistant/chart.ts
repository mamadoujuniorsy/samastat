import type { Indicator } from '../indicators/indicator.types.js';
import { formatValue } from './answer-renderer.js';

/**
 * Détection déterministe d'une évolution ou d'une comparaison parmi les enregistrements
 * récupérés. Aucune valeur n'est calculée ni interpolée : les points sont les enregistrements.
 */
export interface ChartPoint {
  label: string;
  value: number;
  formattedValue: string;
  indicatorId: string;
}

export interface ChartHint {
  kind: 'evolution' | 'comparison';
  title: string;
  unit: string;
  points: ChartPoint[];
}

/** Ordre chronologique approximatif à partir d'une période textuelle (2023, 2021-2022, T1 2026). */
function periodKey(period: string): number {
  const year = Number(/(\d{4})/.exec(period)?.[1] ?? 0);
  const quarter = Number(/T(\d)/i.exec(period)?.[1] ?? 0);
  return year * 10 + quarter;
}

export function buildChart(records: Indicator[]): ChartHint | null {
  if (records.length < 2) return null;

  const groups = new Map<string, Indicator[]>();
  for (const r of records) {
    const key = `${r.name}|${r.unit}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const best = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  if (!best || best.length < 2) return null;

  const territories = new Set(best.map((r) => r.territory));
  const periods = new Set(best.map((r) => r.period));
  const name = best[0].name;
  const unit = best[0].unit;

  if (territories.size === 1 && periods.size === best.length) {
    const sorted = [...best].sort((a, b) => periodKey(a.period) - periodKey(b.period));
    return {
      kind: 'evolution',
      title: `${name} — ${sorted[0].territory}`,
      unit,
      points: sorted.map((r) => ({
        label: r.period,
        value: r.value,
        formattedValue: formatValue(r),
        indicatorId: r.id,
      })),
    };
  }

  if (periods.size === 1 && territories.size === best.length) {
    const sorted = [...best].sort((a, b) => b.value - a.value);
    return {
      kind: 'comparison',
      title: `${name} — ${sorted[0].period}`,
      unit,
      points: sorted.map((r) => ({
        label: r.territory,
        value: r.value,
        formattedValue: formatValue(r),
        indicatorId: r.id,
      })),
    };
  }

  return null;
}
