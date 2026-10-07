import type { Indicator } from '../indicators/indicator.types.js';

/**
 * Suggestions de suite déterministes, construites depuis la base (jamais par le modèle) :
 * autres territoires et autres périodes du même indicateur. Chaque suggestion est une
 * question en français que le système sait traiter.
 */
export interface FollowUp {
  kind: 'compare' | 'evolution' | 'all_regions' | 'national';
  label: string;
  question: string;
}

function lower(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function article(name: string): string {
  const n = lower(name);
  if (/^[aeiouyàâéèêëîïôûù]/i.test(n)) return `l'${n}`;
  if (/^(taux|nombre|quotient|ratio|âge|indice|pib)/i.test(n)) return `le ${n}`;
  return `la ${n}`;
}

function where(territory: string): string {
  if (territory === 'Sénégal') return 'au Sénégal';
  if (/^Sénégal, milieu/.test(territory)) return `en ${territory.replace('Sénégal, milieu ', 'milieu ')}`;
  if (/^Département de /.test(territory)) return `dans le ${territory.replace(/^Département de /, 'département de ')}`;
  if (/^Commune de /.test(territory)) return `dans la ${territory.replace(/^Commune de /, 'commune de ')}`;
  return `dans la ${territory.replace(/^Région de /, 'région de ')}`;
}

function periodKey(period: string): number {
  const year = Number(/(\d{4})/.exec(period)?.[1] ?? 0);
  const quarter = Number(/T(\d)/i.exec(period)?.[1] ?? 0);
  return year * 10 + quarter;
}

export function buildFollowUps(cited: Indicator[], related: Indicator[], max = 4): FollowUp[] {
  if (!cited.length) return [];
  const out: FollowUp[] = [];
  const seen = new Set<string>();
  const push = (f: FollowUp) => {
    if (out.length < max && !seen.has(f.question)) {
      seen.add(f.question);
      out.push(f);
    }
  };

  const first = cited[0];
  const name = first.name;
  const sameIndicator = related.filter((r) => r.name === name && r.unit === first.unit);
  const citedIds = new Set(cited.map((c) => c.id));
  const citedTerritories = new Set(cited.map((c) => c.territory));
  const citedPeriods = new Set(cited.map((c) => c.period));

  // Évolution : plusieurs périodes pour le territoire cité.
  const periods = [...new Set(sameIndicator.filter((r) => citedTerritories.has(r.territory)).map((r) => r.period))].sort(
    (a, b) => periodKey(a) - periodKey(b),
  );
  if (periods.length >= 2 && citedPeriods.size < periods.length) {
    push({
      kind: 'evolution',
      label: `Évolution ${periods[0]} → ${periods[periods.length - 1]}`,
      question: `Comment a évolué ${article(name)} ${where(first.territory)} entre ${periods[0]} et ${periods[periods.length - 1]} ?`,
    });
  }

  // Comparaison : autres territoires du même niveau (régions, départements, communes) à la même période.
  const level = first.territory_level === 'national' ? 'region' : first.territory_level;
  const peers = sameIndicator.filter(
    (r) => r.territory_level === level && citedPeriods.has(r.period) && !citedIds.has(r.id),
  );
  if (level === 'region' && peers.length >= 4 && cited.length < 4) {
    push({
      kind: 'all_regions',
      label: 'Toutes les régions',
      question: `Compare ${article(name)} de toutes les régions en ${first.period}.`,
    });
  }
  for (const r of peers.slice(0, 2)) {
    push({
      kind: 'compare',
      label: `Et ${r.territory.replace(/^(Région|Département|Commune) de /, '')} ?`,
      question: `Quel est ${article(name)} ${where(r.territory)} en ${r.period} ?`,
    });
  }

  // Niveau national si la question portait sur une région.
  const national = sameIndicator.find((r) => r.territory === 'Sénégal' && citedPeriods.has(r.period) && !citedIds.has(r.id));
  if (national) {
    push({
      kind: 'national',
      label: 'Au niveau national',
      question: `Quel est ${article(name)} au Sénégal en ${national.period} ?`,
    });
  }

  return out;
}
