import { describe, expect, it } from 'vitest';
import { detectLanguage, lexiconHits, normalizeWolofForSearch, searchHints } from './wolof.js';

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

  it('formule des indices de recherche lisibles', () => {
    expect(searchHints('Ñaata nit ?')).toContain('→');
    expect(searchHints('Quelle est la population ?')).toBeNull();
  });

  it('normalise les variantes courantes de transcription sans modifier la question affichée', () => {
    expect(normalizeWolofForSearch('Ñaata nit ñoo dëkk Ndakaaru ?')).toContain('Dakar');
    expect(normalizeWolofForSearch('Naata la njëg yi yokku ci Senegaal ?')).toContain('njëg');
    expect(searchHints('Naata la njeg yi yokku ci Senegal ?')).toContain('prix inflation');
  });
});
