import type { Indicator } from '../indicators/indicator.types.js';
import type { Survey } from '../indicators/surveys.repository.js';

/**
 * Rendu des réponses et garde anti-invention.
 *
 * Le modèle écrit des placeholders {{champ:ID}} ; le serveur les remplace par
 * les champs de l'enregistrement correspondant. Toute séquence de chiffres
 * écrite directement par le modèle, ou tout placeholder pointant vers un
 * enregistrement non récupéré, invalide la réponse : on rend alors un texte
 * déterministe construit uniquement à partir des enregistrements.
 */

const PLACEHOLDER =
  /\{\{\s*(value|period|territory|source|name|unit|survey|survey_url)\s*:\s*([A-Za-z0-9._-]+)\s*\}\}/g;

export type GuardResult = 'passed' | 'fallback';

export interface RenderedAnswer {
  text: string;
  guard: GuardResult;
  violations: string[];
}

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function formatValue(ind: Pick<Indicator, 'value' | 'unit'>): string {
  const n = numberFormat.format(ind.value);
  if (ind.unit === '%') return `${n} %`;
  return `${n} ${ind.unit}`;
}

export function surveyLabel(s: Pick<Survey, 'title' | 'year_start' | 'year_end'>): string {
  const years = [s.year_start, s.year_end].filter((y): y is number => y != null);
  if (!years.length) return s.title;
  const span = years[1] && years[1] !== years[0] ? `${years[0]}-${years[1]}` : `${years[0]}`;
  return s.title.includes(span) ? s.title : `${s.title} (${span})`;
}

/** Réponse de repli : uniquement des champs de la base, aucune formulation libre. */
export function fallbackAnswer(records: Indicator[], surveys: Survey[] = []): string {
  const lines = records.map(
    (r) => `${r.name} — ${r.territory}, ${r.period} : ${formatValue(r)}. Source : ${r.source}.`,
  );
  if (surveys.length) {
    lines.push(`Enquêtes ANADS liées : ${surveys.map((s) => `${surveyLabel(s)} — ${s.url}`).join(' ; ')}.`);
  }
  if (!lines.length) return "Je n'ai pas cette donnée dans le catalogue SamaStat pour l'instant.";
  return lines.join('\n');
}

export function renderAnswer(raw: string, records: Indicator[], surveys: Survey[] = []): RenderedAnswer {
  const byId = new Map(records.map((r) => [r.id, r]));
  const byIdno = new Map(surveys.map((s) => [s.idno, s]));
  const violations: string[] = [];

  // 1. Tout placeholder doit viser un enregistrement effectivement récupéré.
  for (const m of raw.matchAll(PLACEHOLDER)) {
    const isSurvey = m[1].startsWith('survey');
    if (isSurvey ? !byIdno.has(m[2]) : !byId.has(m[2])) {
      violations.push(`placeholder vers un enregistrement non récupéré : ${m[0]}`);
    }
  }

  // 2. Hors placeholders, aucun chiffre n'est toléré.
  const stripped = raw.replace(PLACEHOLDER, '');
  const digits = stripped.match(/\d[\d\s  .,]*/g);
  if (digits) violations.push(`chiffres écrits par le modèle : ${digits.map((d) => d.trim()).join(', ')}`);

  if (violations.length) {
    return { text: fallbackAnswer(records, surveys), guard: 'fallback', violations };
  }

  const text = raw.replace(PLACEHOLDER, (_m, field: string, id: string) => {
    if (field === 'survey' || field === 'survey_url') {
      const s = byIdno.get(id)!;
      return field === 'survey' ? surveyLabel(s) : s.url;
    }
    const r = byId.get(id)!;
    switch (field) {
      case 'value':
        return formatValue(r);
      case 'unit':
        return r.unit;
      case 'period':
        return r.period;
      case 'territory':
        return r.territory;
      case 'source':
        return r.source;
      case 'name':
        return r.name;
      default:
        return '';
    }
  });

  return { text: text.trim(), guard: 'passed', violations: [] };
}
