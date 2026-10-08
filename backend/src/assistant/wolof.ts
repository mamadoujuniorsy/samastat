/**
 * Amorce wolof (Jalon 5, approche graduée) : un lexique de formulations courantes
 * associées à des mots-clés français de recherche, et une détection de langue heuristique.
 *
 * Ce lexique est volontairement petit et doit être relu par un locuteur avant extension.
 * Il ne prétend à aucune couverture complète : une question wolof hors lexique est traitée
 * comme « unknown » et le modèle fait au mieux.
 */
import type { Indicator } from '../indicators/indicator.types.js';

export type Language = 'fr' | 'wo' | 'unknown';

interface LexiconEntry {
  /** Formes rencontrées (avec et sans diacritiques), en minuscules. */
  forms: string[];
  /** Mots-clés français injectés comme indices de recherche. */
  french: string;
}

export const WOLOF_LEXICON: LexiconEntry[] = [
  // Quantité et interrogation
  { forms: ['ñaata', 'nyaata', 'ñata', 'naata'], french: 'combien' },
  { forms: ['tollu', 'tollu ci', 'tolluwaay'], french: 'effectif taux valeur montant s élève' },
  { forms: ['lim', 'limu'], french: 'nombre total effectif chiffre' },
  { forms: ['xaaj', 'porseentaas'], french: 'taux pourcentage proportion part' },
  { forms: ['gën a bare', 'gën a kawe', 'moo gën a bare'], french: 'le plus élevé maximum supérieur' },
  { forms: ['gën a néew', 'gën a suufe', 'gën a wàññiku'], french: 'le plus faible minimum inférieur' },
  { forms: ['ban', 'yan'], french: 'quel quelle quels' },

  // Population et démographie (RGPH-5)
  { forms: ['askan', 'askanu', 'askaan'], french: 'population habitants' },
  { forms: ['nit ñi', 'nit ni', 'nit yi', 'nit'], french: 'population habitants' },
  { forms: ['dëkk', 'dekk', 'dëkkuwaay'], french: 'habitants population résidente' },
  { forms: ['jigéen', 'jigeen', 'jigéen ñi'], french: 'femmes' },
  { forms: ['góor', 'goor', 'góor ñi'], french: 'hommes' },
  { forms: ['xale yi', 'xale', 'goné', 'gone'], french: 'enfants mortalité infantile' },
  { forms: ['ndaw yi', 'ndaw', 'ndaw ñi'], french: 'jeunes jeunesse 15-24 ans' },
  { forms: ['mag ñi', 'mag yi', 'mag'], french: 'personnes âgées 60 ans et plus' },
  { forms: ['kër yi', 'kër', 'keur', 'kërog'], french: 'ménages concessions taille des ménages' },
  { forms: ['juddu', 'juddoo', 'jur'], french: 'naissances fécondité enfants par femme' },
  { forms: ['dund', 'dundu', 'yàgg dund'], french: 'espérance de vie' },
  { forms: ['faatu', 'dee', 'deey xale'], french: 'décès mortalité infantile' },

  // Territoires et localités
  { forms: ['réew mi', 'reew mi', 'senegaal'], french: 'Sénégal national' },
  { forms: ['ndakaaru', 'dakar'], french: 'Dakar région' },
  { forms: ['diiwaan', 'diwaanu', 'diiwaani'], french: 'région' },
  { forms: ['departemaa', 'dpartmaa'], french: 'département' },
  { forms: ['komiin', 'komun'], french: 'commune' },
  { forms: ['gox', 'gox-goxaan', 'pàkk'], french: 'région département territoire zone' },
  { forms: ['kaw', 'all bi'], french: 'rural campagne' },
  { forms: ['taax', 'dëkk bu mag'], french: 'urbain ville' },

  // Économie, travail, coût de la vie (EHCVM, ENES, IHPC)
  { forms: ['liggéey', 'liggeey', 'ligeey'], french: 'emploi travail main d oeuvre' },
  { forms: ['amul liggéey', 'amul liggeey', 'amuñu liggéey', 'ñàkk liggéey'], french: 'chômage taux de chômage' },
  { forms: ['njëg', 'njeg', 'njëgu', 'njegu', 'jafe-jafe njëg'], french: 'prix inflation IHPC coût de la vie' },
  { forms: ['ndóol', 'ndool', 'ñàkk', 'ñakk'], french: 'pauvreté taux de pauvreté seuil de pauvreté' },
  { forms: ['koom-koom', 'koom', 'kom-kom'], french: 'PIB économie produit intérieur brut croissance' },
  { forms: ['yokkute', 'yokkuté', 'yokku'], french: 'croissance hausse augmentation' },
  { forms: ['wàññiku', 'waññiku', 'wàcc'], french: 'baisse diminution ralentissement' },

  // Santé, éducation, habitat (EDS-2023, SES)
  { forms: ['wér-gu-yaram', 'wergu yaram', 'wér'], french: 'santé' },
  { forms: ['faj', 'faju', 'doktoor', 'lopitaan'], french: 'santé personnel médical médecins accouchement' },
  { forms: ['ñàdd', 'ñadd', 'vaksin'], french: 'vaccination couverture vaccinale' },
  { forms: ['ñàkk ñam', 'doyadi'], french: 'malnutrition retard de croissance' },
  { forms: ['njàng', 'jang', 'njàngat', 'ekool', 'daara'], french: 'éducation scolarisation alphabétisation' },
  { forms: ['xam mbind', 'mokkal'], french: 'alphabétisation lire écrire' },
  { forms: ['ndox', 'ndox mu set'], french: 'eau potable accès à l eau' },
  { forms: ['kuraŋ', 'kurang'], french: 'électricité énergie' },

  // Temps
  { forms: ['at mi', 'atum', 'at yi'], french: 'année période' },
];

/** Marqueurs grammaticaux fréquents du wolof, absents du français. */
const WOLOF_MARKERS = [
  'la', 'lañu', 'nañu', 'ngi', 'ci', 'ak', 'bu', 'gi', 'mi', 'yi', 'ñi', 'lu', 'nan', 'ana',
  'lan', 'lane', 'ban', 'yan', 'fan', 'kan', 'ñan', 'moo', 'gën', 'bare', 'bari', 'am', 'na',
  'nekk', 'nekka', 'dafa', 'ñoo', 'tollu', 'wax', 'ma', 'loo', 'xame', 'xam', 'ndax', 'waaw',
  'te', 'ndaxte', 'kat', 'nag', 'rek', 'rekk', 'tamit', 'itam'
];
const FRENCH_MARKERS = ['quelle', 'quel', 'quels', 'quelles', 'est', 'sont', 'combien', 'le', 'la', 'les', 'de', 'des', 'du', 'en', 'au', 'aux', 'taux', 'population'];

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
  // Une seule lettre spécifique suffit : les locuteurs omettent souvent les
  // diacritiques au clavier, mais les lettres ñ/ë/ŋ restent de bons signaux.
  const hasWolofLetter = /[ñëŋɗɓƴ]/i.test(question);

  const wolofScore = hits * 2 + wolofMarkers + (hasWolofLetter ? 1 : 0);
  if (hits >= 1 && wolofScore > french) return 'wo';
  if (french >= 1 && french >= wolofScore) return 'fr';
  if (wolofScore >= 2 && (wolofMarkers >= 2 || hasWolofLetter)) return 'wo';
  return french > 0 ? 'fr' : 'unknown';
}

/** Note ajoutée au message utilisateur pour aider la recherche : formes wolof → mots-clés français. */
export function searchHints(question: string): string | null {
  const hits = lexiconHits(normalizeWolofForSearch(question));
  if (!hits.length) return null;
  return hits.map((h) => `« ${h.form} » → ${h.french}`).join(' ; ');
}

/**
 * Normalise uniquement les variantes fréquentes produites par Whisper.
 * Le texte original reste affiché et envoyé au modèle ; cette version sert
 * exclusivement à améliorer la recherche dans le catalogue ANSD.
 */
export function normalizeWolofForSearch(question: string): string {
  return question
    .replace(/\b(?:ndakaaru|ndakaru|dakarou)\b/gi, 'Dakar')
    .replace(/\b(?:senegaal|senegal)\b/gi, 'Sénégal')
    .replace(/\b(?:liggeey|ligeey)\b/gi, 'liggéey')
    .replace(/\b(?:jigeen)\b/gi, 'jigéen')
    .replace(/\b(?:goor)\b/gi, 'góor')
    .replace(/\b(?:njeg|njegu)\b/gi, 'njëg')
    .replace(/\b(?:waññiku|wanñiku)\b/gi, 'wàññiku')
    .replace(/\b(?:yokku|yokkute)\b/gi, 'yokkute');
}

/**
 * Formulation courte et contrôlée pour la synthèse vocale.
 * Elle évite de faire traduire les réponses statistiques simples par NLLB,
 * qui peut produire une phrase plausible mais linguistiquement incorrecte.
 */
export function conciseWolofStatistic(record: Pick<Indicator, 'name' | 'value' | 'unit' | 'territory' | 'period'>): string {
  const value = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(record.value);
  const name = normalize(record.name);
  const territory = record.territory;
  const period = record.period;

  if (name.includes('chomage')) {
    return `Amul liggéey ci ${territory} mooy ${value} pour cent ci ${period}.`;
  }
  if (name.includes('pauvrete')) {
    return `Ndóol ci ${territory} mooy ${value} pour cent ci ${period}.`;
  }
  if (record.unit === '%') {
    return `${record.name} ci ${territory} mooy ${value} pour cent ci ${period}.`;
  }
  if (record.unit.toLowerCase().includes('habitant') || name.includes('population')) {
    return `${territory} am na ${value} nit ci ${period}.`;
  }
  return `${record.name} ci ${territory} mooy ${value} ${record.unit} ci ${period}.`;
}
