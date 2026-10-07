import { describe, expect, it } from 'vitest';
import { buildFollowUps } from './follow-ups.js';
import type { Indicator } from '../indicators/indicator.types.js';

const base: Indicator = {
  id: 'p-dakar',
  name: 'Taux de pauvreté monétaire',
  description: null,
  value: 9.3,
  unit: '%',
  territory: 'Région de Dakar',
  territory_level: 'region',
  period: '2021-2022',
  source: 'ANSD',
  platform: 'ansd.sn',
  url: 'https://www.ansd.sn/',
  keywords: [],
  domain: 'conditions de vie',
  verified_at: '2026-09-15',
};
const related: Indicator[] = [
  base,
  { ...base, id: 'p-thies', territory: 'Région de Thiès', value: 29.9 },
  { ...base, id: 'p-kaolack', territory: 'Région de Kaolack', value: 49.6 },
  { ...base, id: 'p-kolda', territory: 'Région de Kolda', value: 62.5 },
  { ...base, id: 'p-fatick', territory: 'Région de Fatick', value: 46.5 },
  { ...base, id: 'p-sn', territory: 'Sénégal', territory_level: 'national', value: 37.5 },
];

describe('buildFollowUps', () => {
  it('propose les autres régions, toutes les régions et le niveau national', () => {
    const f = buildFollowUps([base], related);
    expect(f.map((x) => x.kind)).toEqual(['all_regions', 'compare', 'compare', 'national']);
    expect(f[1].question).toBe('Quel est le taux de pauvreté monétaire dans la région de Thiès en 2021-2022 ?');
    expect(f[3].question).toBe('Quel est le taux de pauvreté monétaire au Sénégal en 2021-2022 ?');
  });

  it('propose une évolution quand plusieurs périodes existent', () => {
    const infl: Indicator = { ...base, id: 'i25', name: "Taux d'inflation annuel (IHPC)", territory: 'Sénégal', territory_level: 'national', period: '2025', value: 1.4 };
    const f = buildFollowUps([infl], [infl, { ...infl, id: 'i23', period: '2023', value: 5.9 }, { ...infl, id: 'i24', period: '2024', value: 0.8 }]);
    expect(f[0].kind).toBe('evolution');
    expect(f[0].question).toBe("Comment a évolué le taux d'inflation annuel (IHPC) au Sénégal entre 2023 et 2025 ?");
  });

  it('ne propose rien sans enregistrement cité', () => {
    expect(buildFollowUps([], related)).toEqual([]);
  });
});
