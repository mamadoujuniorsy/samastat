import { describe, expect, it } from 'vitest';
import { prepareWolofTtsText } from './wolof-tts.service.js';

describe('prepareWolofTtsText', () => {
  it('prépare le texte wolof pour le tokenizer vocal', () => {
    expect(prepareWolofTtsText('Taxawu jang ci Senegaal : 58,8 %.'))
      .toBe('taxawu jang ci senegaal 58,8 pour cent .');
  });
});
