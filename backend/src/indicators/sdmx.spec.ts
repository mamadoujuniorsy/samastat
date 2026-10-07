import { describe, expect, it } from 'vitest';
import { toSdmxJson } from './sdmx.js';
import type { Indicator } from './indicator.types.js';

const base: Indicator = {
  id: 'i23',
  name: "Taux d'inflation annuel (IHPC)",
  description: null,
  value: 5.9,
  unit: '%',
  territory: 'Sénégal',
  territory_level: 'national',
  period: '2023',
  source: 'ANSD — IHPC',
  platform: 'ansd.sn',
  url: 'https://www.ansd.sn/',
  keywords: [],
  domain: 'prix',
  verified_at: '2026-09-15',
};

describe('toSdmxJson', () => {
  it('produit une série par indicateur × zone avec une observation par période', () => {
    const msg = toSdmxJson([base, { ...base, id: 'i24', period: '2024', value: 0.8 }], 'attribution');
    const structure = msg.data.structures[0];
    expect(structure.dimensions.series.map((d) => d.id)).toEqual(['INDICATOR', 'REF_AREA']);
    expect(structure.dimensions.series[0].values[0].id).toBe('TAUX_D_INFLATION_ANNUEL_IHPC');
    expect(structure.dimensions.observation[0].values.map((v) => v.id)).toEqual(['2023', '2024']);
    const series = msg.data.dataSets[0].series['0:0'];
    expect(series.attributes).toEqual(['%', 'ANSD — IHPC', 'https://www.ansd.sn/', '2026-09-15']);
    expect(series.observations['0']).toEqual([5.9, 'i23']);
    expect(series.observations['1']).toEqual([0.8, 'i24']);
    expect(msg.meta.links[0].title).toBe('attribution');
  });
});
