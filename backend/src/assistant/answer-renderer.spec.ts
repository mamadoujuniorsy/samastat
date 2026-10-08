import { describe, expect, it } from 'vitest';
import { fallbackAnswer, formatValue, renderAnswer } from './answer-renderer.js';
import type { Indicator } from '../indicators/indicator.types.js';

const dakar: Indicator = {
  id: 'rgph5-2023-population-region-dakar',
  name: 'Population résidente',
  description: null,
  value: 4004426,
  unit: 'habitants',
  territory: 'Région de Dakar',
  territory_level: 'region',
  period: '2023',
  source: 'ANSD — RGPH-5 (2023), rapport définitif, chapitre 1',
  platform: 'ansd.sn',
  url: 'https://www.ansd.sn/',
  keywords: [],
  domain: 'démographie',
  verified_at: '2026-09-15',
};

const rgph5 = {
  idno: 'SEN-ANSD-RGPH5-2023-V1.1',
  nada_id: 311,
  title: 'Recensement Général de la Population et de l’Habitat 2023',
  year_start: 2023,
  year_end: 2023,
  authoring_entity: 'ANSD',
  abstract: null,
  keywords: [],
  url: 'https://anads.ansd.sn/index.php/catalog/311',
};

const chomage: Indicator = { ...dakar, id: 'enes-chomage', name: 'Taux de chômage', value: 22.9, unit: '%' };

describe('formatValue', () => {
  it('formate en français avec unité', () => {
    expect(formatValue(dakar)).toBe('4 004 426 habitants');
    expect(formatValue(chomage)).toBe('22,9 %');
  });
});

describe('renderAnswer', () => {
  it('remplace les placeholders par les champs de la base', () => {
    const r = renderAnswer(
      'La {{name:rgph5-2023-population-region-dakar}} de la {{territory:rgph5-2023-population-region-dakar}} est de {{value:rgph5-2023-population-region-dakar}} en {{period:rgph5-2023-population-region-dakar}} ({{source:rgph5-2023-population-region-dakar}}).',
      [dakar],
    );
    expect(r.guard).toBe('passed');
    expect(r.text).toBe(
      'La Population résidente de la Région de Dakar est de 4 004 426 habitants en 2023 (ANSD — RGPH-5 (2023), rapport définitif, chapitre 1).',
    );
  });

  it('rejette tout chiffre écrit par le modèle', () => {
    const r = renderAnswer('Dakar compte environ 4 millions d’habitants en 2023.', [dakar]);
    expect(r.guard).toBe('fallback');
    expect(r.violations[0]).toContain('chiffres écrits par le modèle');
    expect(r.text).toBe(fallbackAnswer([dakar]));
    expect(r.text).toContain('4 004 426 habitants');
  });

  it('rejette un placeholder vers un enregistrement non récupéré', () => {
    const r = renderAnswer('Le taux est de {{value:inconnu}}.', [dakar]);
    expect(r.guard).toBe('fallback');
    expect(r.violations[0]).toContain('inconnu');
  });

  it('tolère les espaces dans les placeholders', () => {
    const r = renderAnswer('Chômage : {{ value : enes-chomage }}.', [chomage]);
    expect(r.guard).toBe('passed');
    expect(r.text).toBe('Chômage : 22,9 %.');
  });

  it('rend une étude ANADS par placeholder, années comprises', () => {
    const r = renderAnswer('Voir {{survey:SEN-ANSD-RGPH5-2023-V1.1}} : {{survey_url:SEN-ANSD-RGPH5-2023-V1.1}}.', [], [rgph5]);
    expect(r.guard).toBe('passed');
    expect(r.text).toBe(
      'Voir Recensement Général de la Population et de l’Habitat 2023 : https://anads.ansd.sn/index.php/catalog/311.',
    );
  });

  it('rejette une année d’enquête écrite par le modèle', () => {
    const r = renderAnswer('Voir le recensement de 2023.', [], [rgph5]);
    expect(r.guard).toBe('fallback');
    expect(r.text).toMatch(/pas cette donnée/);
  });

  it('produit un repli sans données quand la liste est vide', () => {
    expect(fallbackAnswer([])).toMatch(/pas cette donnée/);
  });
});
