import { describe, expect, it } from 'vitest';
import { buildChart } from './chart.js';
import type { Indicator } from '../indicators/indicator.types.js';

const base: Indicator = {
  id: 'x',
  name: "Taux d'inflation annuel (IHPC)",
  description: null,
  value: 1,
  unit: '%',
  territory: 'Sénégal',
  territory_level: 'national',
  period: '2025',
  source: 'ANSD',
  platform: 'ansd.sn',
  url: 'https://www.ansd.sn/',
  keywords: [],
  domain: 'prix',
  verified_at: '2026-09-15',
};

describe('buildChart', () => {
  it('ne produit rien avec un seul enregistrement', () => {
    expect(buildChart([base])).toBeNull();
  });

  it('détecte une évolution (même territoire, périodes différentes) et trie chronologiquement', () => {
    const chart = buildChart([
      { ...base, id: 'i25', period: '2025', value: 1.4 },
      { ...base, id: 'i23', period: '2023', value: 5.9 },
      { ...base, id: 'i24', period: '2024', value: 0.8 },
    ]);
    expect(chart?.kind).toBe('evolution');
    expect(chart?.points.map((p) => p.label)).toEqual(['2023', '2024', '2025']);
    expect(chart?.points.map((p) => p.value)).toEqual([5.9, 0.8, 1.4]);
    expect(chart?.points[0].formattedValue).toBe('5,9 %');
  });

  it('détecte une comparaison (même période, territoires différents) triée par valeur', () => {
    const chart = buildChart([
      { ...base, id: 'd', name: 'Taux de pauvreté', territory: 'Région de Dakar', period: '2021-2022', value: 9.3 },
      { ...base, id: 't', name: 'Taux de pauvreté', territory: 'Région de Thiès', period: '2021-2022', value: 29.9 },
    ]);
    expect(chart?.kind).toBe('comparison');
    expect(chart?.points.map((p) => p.label)).toEqual(['Région de Thiès', 'Région de Dakar']);
  });

  it('ne produit rien si territoires et périodes varient en même temps', () => {
    expect(
      buildChart([
        { ...base, id: 'a', territory: 'Dakar', period: '2023' },
        { ...base, id: 'b', territory: 'Thiès', period: '2024' },
      ]),
    ).toBeNull();
  });

  it('ignore les enregistrements d’indicateurs différents', () => {
    const chart = buildChart([
      { ...base, id: 'a', period: '2023', value: 5.9 },
      { ...base, id: 'b', period: '2024', value: 0.8 },
      { ...base, id: 'c', name: 'Population', unit: 'habitants', value: 18126390 },
    ]);
    expect(chart?.kind).toBe('evolution');
    expect(chart?.points).toHaveLength(2);
  });
});
