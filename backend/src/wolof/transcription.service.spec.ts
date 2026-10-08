import { describe, expect, it } from 'vitest';
import { normalizeWolofTranscript } from './transcription.service.js';

describe('normalizeWolofTranscript', () => {
  it('corrige une transcription phonétique connue de la question de population', () => {
    expect(normalizeWolofTranscript('Deni, nyodeg, dagar.'))
      .toBe('Ñaata nit ñoo dëkk Dakar ?');
  });

  it('ne réécrit pas une phrase wolof non reconnue', () => {
    expect(normalizeWolofTranscript('Lan mooy taux bi ?')).toBe('Lan mooy taux bi ?');
  });
});
