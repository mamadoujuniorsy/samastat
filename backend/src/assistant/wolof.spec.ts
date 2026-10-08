import { describe, expect, it } from 'vitest';
import { conciseWolofStatistic, detectLanguage, lexiconHits, normalizeWolofForSearch, searchHints, wolofSearchContext } from './wolof.js';

describe('detectLanguage', () => {
  it('reconnaît une question en français', () => {
    expect(detectLanguage('Quelle est la population de la région de Dakar ?')).toBe('fr');
    expect(detectLanguage('Quel est le taux de chômage en 2026 ?')).toBe('fr');
  });

  it('reconnaît une question wolof du lexique', () => {
    expect(detectLanguage('Ñaata nit ñoo dëkk Dakar ?')).toBe('wo');
    expect(detectLanguage('Naata nit la ci Senegaal ?')).toBe('wo');
  });

  it('reconnaît le wolof quand les diacritiques sont partiels', () => {
    expect(detectLanguage('Ñaata nit ñoo dekk Dakar ?')).toBe('wo');
    expect(detectLanguage('Lan mooy taux bi ci Senegaal ?')).toBe('wo');
  });

  it('renvoie unknown pour une salutation neutre', () => {
    expect(detectLanguage('Bonjour')).toBe('unknown');
  });
});

describe('lexique', () => {
  it('trouve les formes avec et sans diacritiques', () => {
    const hits = lexiconHits('ñaata nit ñoo dekk Dakar');
    expect(hits.map((h) => h.french)).toEqual(expect.arrayContaining(['combien', 'population habitants']));
  });

  describe('réponse statistique', () => {
    it('produit une phrase courte pour une population', () => {
      expect(conciseWolofStatistic({
        name: 'Population résidente',
        value: 4004426,
        unit: 'habitants',
        territory: 'Dakar',
        period: '2023',
      })).toBe('Dakar am na 4 004 426 nit ci 2023.');
    });

    it('produit une phrase courte pour un pourcentage', () => {
      expect(conciseWolofStatistic({
        name: 'Taux de chômage',
        value: 22.9,
        unit: '%',
        territory: 'Dakar',
        period: '2023',
      })).toBe('Amul liggéey ci Dakar mooy 22,9 pour cent ci 2023.');
    });
  });

  it('formule des indices de recherche lisibles', () => {
    expect(searchHints('Ñaata nit ?')).toContain('→');
    expect(searchHints('Quelle est la population ?')).toBeNull();
  });

  it('normalise les variantes courantes de transcription sans modifier la question affichée', () => {
    expect(normalizeWolofForSearch('Ñaata nit ñoo dëkk Ndakaaru ?')).toContain('Dakar');
    expect(normalizeWolofForSearch('Naata la njëg yi yokku ci Senegaal ?')).toContain('njëg');
    expect(searchHints('Naata la njeg yi yokku ci Senegal ?')).toContain('prix inflation');
  });

  it('extrait une intention et un territoire pour guider la recherche', () => {
    expect(wolofSearchContext('Ñaata nit ñoo dëkk Dakar ci 2023 ?'))
      .toContain('territoire=Dakar');
    expect(wolofSearchContext('Ñaata nit ñoo dëkk Dakar ci 2023 ?'))
      .toContain('population');
    expect(wolofSearchContext('Question inconnue')).toBeNull();
  });
});
