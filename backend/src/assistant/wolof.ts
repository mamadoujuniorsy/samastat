/**
 * Amorce wolof (Jalon 5, approche graduée) : un lexique de formulations courantes
 * associées à des mots-clés français de recherche, et une détection de langue heuristique.
 *
 * Ce lexique est volontairement petit et doit être relu par un locuteur avant extension.
 * Il ne prétend à aucune couverture complète : une question wolof hors lexique est traitée
 * comme « unknown » et le modèle fait au mieux.
 */

export type Language = 'fr' | 'wo' | 'unknown';

interface LexiconEntry {
  /** Formes rencontrées (avec et sans diacritiques), en minuscules. */
  forms: string[];
  /** Mots-clés français injectés comme indices de recherche. */
  french: string;
}

export const WOLOF_LEXICON: LexiconEntry[] = [
  { forms: ['ñaata', 'nyaata', 'ñata', 'naata'], french: 'combien' },
  { forms: ['nit ñi', 'nit ni', 'nit yi', 'nit'], french: 'population habitants' },
  { forms: ['dëkk', 'dekk', 'dëkkuwaay'], french: 'habitants population' },
  { forms: ['réew mi', 'reew mi', 'senegaal'], french: 'Sénégal' },
  { forms: ['liggéey', 'liggeey', 'ligeey'], french: 'emploi travail' },
  { forms: ['amul liggéey', 'amul liggeey', 'amuñu liggéey'], french: 'chômage' },
  { forms: ['njëg', 'njeg', 'njëgu', 'njegu', 'jafe-jafe njëg'], french: 'prix inflation coût de la vie' },
  { forms: ['ndóol', 'ndool', 'ñàkk', 'ñakk'], french: 'pauvreté' },
  { forms: ['jigéen', 'jigeen', 'jigéen ñi'], french: 'femmes' },
  { forms: ['góor', 'goor', 'góor ñi'], french: 'hommes' },
  { forms: ['juddu', 'juddoo'], french: 'naissances fécondité' },
  { forms: ['dund', 'dundu'], french: 'espérance de vie' },
  { forms: ['xale yi', 'xale'], french: 'enfants' },
  { forms: ['at mi', 'atum'], french: 'année' },
];

/** Marqueurs grammaticaux fréquents du wolof, absents du français. */
const WOLOF_MARKERS = ['la', 'lañu', 'nañu', 'ngi', 'ci', 'ak', 'bu', 'gi', 'mi', 'yi', 'ñi', 'lu', 'nan', 'ana'];
const FRENCH_MARKERS = ['quelle', 'quel', 'est', 'combien', 'le', 'la', 'les', 'de', 'des', 'du', 'en', 'au', 'taux', 'population'];

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokens(s: string): string[] {
  return normalize(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Entrées du lexique présentes dans la question. */
export function lexiconHits(question: string): { form: string; french: string }[] {
  const q = ` ${normalize(question)} `;
  const hits: { form: string; french: string }[] = [];
  for (const entry of WOLOF_LEXICON) {
    const form = entry.forms.find((f) => q.includes(` ${normalize(f)} `));
    if (form) hits.push({ form, french: entry.french });
  }
  return hits;
}

export function detectLanguage(question: string): Language {
  const toks = tokens(question);
  if (!toks.length) return 'unknown';
  const french = toks.filter((t) => FRENCH_MARKERS.includes(t)).length;
  const wolofMarkers = toks.filter((t) => WOLOF_MARKERS.includes(t)).length;
  const hits = lexiconHits(question).length;
  const hasDiacritics = /[ñëóàé]/i.test(question) && /[ñë]/i.test(question);

  const wolofScore = hits * 2 + wolofMarkers + (hasDiacritics ? 1 : 0);
  if (hits >= 1 && wolofScore > french) return 'wo';
  if (french >= 1 && french >= wolofScore) return 'fr';
  if (wolofScore >= 3) return 'wo';
  return french > 0 ? 'fr' : 'unknown';
}

/** Note ajoutée au message utilisateur pour aider la recherche : formes wolof → mots-clés français. */
export function searchHints(question: string): string | null {
  const hits = lexiconHits(question);
  if (!hits.length) return null;
  return hits.map((h) => `« ${h.form} » → ${h.french}`).join(' ; ');
}
