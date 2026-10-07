/**
 * Jetons de substitution protégeant les valeurs pendant une traduction automatique.
 * Les segments protégés (valeurs, périodes, sources) sont remplacés par X1, X2… avant traduction,
 * puis réinsérés. Le traducteur peut changer la casse (x1) : la comparaison l'ignore.
 */
const SENTINEL = /\bX(\d+)\b/gi;

export function protect(text: string, segments: string[]): string {
  let out = text;
  segments.forEach((seg, i) => {
    out = out.replace(seg, `X${i + 1}`);
  });
  return out;
}

/** Réinsère les segments ; null si un jeton manque, est dupliqué ou inconnu. */
export function restore(translated: string, segments: string[]): string | null {
  const found = [...translated.matchAll(SENTINEL)].map((m) => Number(m[1]));
  const expected = segments.map((_, i) => i + 1);
  const ok =
    found.length === expected.length &&
    expected.every((n) => found.filter((f) => f === n).length === 1) &&
    found.every((f) => f >= 1 && f <= segments.length);
  if (!ok) return null;
  return translated.replace(SENTINEL, (_m, n: string) => segments[Number(n) - 1]);
}
