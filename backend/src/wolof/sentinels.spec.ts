import { describe, expect, it } from 'vitest';
import { protect, restore } from './sentinels.js';

describe('jetons de substitution', () => {
  const segments = ['4 004 426 habitants', '2023'];

  it('protège puis restaure les valeurs, même si la casse a changé', () => {
    const t = protect('La population de Dakar est de 4 004 426 habitants en 2023.', segments);
    expect(t).toBe('La population de Dakar est de X1 en X2.');
    expect(restore('Ñi dëkk Dakar mooy x1 ci X2.', segments)).toBe('Ñi dëkk Dakar mooy 4 004 426 habitants ci 2023.');
  });

  it('rejette une traduction qui perd ou duplique un jeton', () => {
    expect(restore('Ñi dëkk Dakar mooy X1.', segments)).toBeNull();
    expect(restore('X1 ak X1 ci X2.', segments)).toBeNull();
    expect(restore('X1 ci X2 ak X3.', segments)).toBeNull();
  });
});
