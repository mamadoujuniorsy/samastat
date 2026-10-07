import type { Indicator } from './indicator.types.js';

/**
 * Export au format SDMX-JSON (profil simplifié, message de données version 2.0.0) : le standard
 * d'échange des instituts nationaux de statistique et du Système Statistique National.
 * Structure : une dimension INDICATOR, une dimension REF_AREA, une dimension TIME_PERIOD ;
 * attributs UNIT_MEASURE, SOURCE, SOURCE_URL, VERIFIED. Aucune valeur n'est transformée.
 */
export function toSdmxJson(records: Indicator[], attribution: string) {
  const indicators = unique(records.map((r) => r.name));
  const areas = unique(records.map((r) => r.territory));
  const periods = unique(records.map((r) => r.period)).sort();
  const idOf = (name: string) => name.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

  const series: Record<string, { attributes: (string | null)[]; observations: Record<string, (number | string | null)[]> }> = {};
  for (const r of records) {
    const key = `${indicators.indexOf(r.name)}:${areas.indexOf(r.territory)}`;
    series[key] ??= { attributes: [r.unit, r.source, r.url, r.verified_at], observations: {} };
    series[key].observations[String(periods.indexOf(r.period))] = [r.value, r.id];
  }

  return {
    meta: {
      schema: 'https://json.sdmx.org/2.0/sdmx-json-data-schema.json',
      id: `SAMASTAT_${Date.now()}`,
      prepared: new Date().toISOString(),
      test: false,
      contentLanguages: ['fr'],
      sender: { id: 'SAMASTAT', name: 'SamaStat (données ANSD)' },
      links: [{ rel: 'attribution', title: attribution, href: 'https://www.ansd.sn' }],
    },
    data: {
      structures: [
        {
          id: 'SAMASTAT_DS',
          name: 'Indicateurs ANSD cités par SamaStat',
          dimensions: {
            series: [
              { id: 'INDICATOR', name: 'Indicateur', keyPosition: 0, values: indicators.map((n) => ({ id: idOf(n), name: n })) },
              { id: 'REF_AREA', name: 'Zone de référence', keyPosition: 1, values: areas.map((a) => ({ id: idOf(a), name: a })) },
            ],
            observation: [{ id: 'TIME_PERIOD', name: 'Période', keyPosition: 2, values: periods.map((p) => ({ id: p, name: p })) }],
          },
          attributes: {
            series: [
              { id: 'UNIT_MEASURE', name: 'Unité de mesure' },
              { id: 'SOURCE', name: 'Source' },
              { id: 'SOURCE_URL', name: 'URL de la source' },
              { id: 'VERIFIED', name: 'Date de vérification' },
            ],
            observation: [{ id: 'OBS_ID', name: 'Identifiant SamaStat' }],
          },
        },
      ],
      dataSets: [
        {
          structure: 0,
          action: 'Information',
          series,
        },
      ],
    },
  };
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
