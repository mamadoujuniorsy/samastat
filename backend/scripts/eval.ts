import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Protocole de validation (livrable 6 de la proposition) :
 * pose chaque question de eval/questions.json à l'API et mesure
 *   - justesse   : les enregistrements attendus sont bien ceux cités
 *   - non-réponse assumée : no_data attendu et obtenu
 *   - erreur     : valeur citée alors qu'aucune n'était attendue, ou mauvais enregistrement
 * Les valeurs attendues ne sont pas recopiées ici : elles sont celles de la base, elles-mêmes
 * vérifiées contre les publications ANSD (docs/sources-donnees.md).
 *
 *   npm run eval -- --api http://localhost:3001 --out eval/report.json
 */

interface Question {
  question: string;
  expected_indicator_ids: string[];
  note?: string;
}

interface AskResponse {
  status: string;
  answer: string;
  data: { indicatorId: string; formattedValue: string }[];
  meta: { guard: string | null; latencyMs: number; cached: boolean; language: string };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const api = opt('--api', process.env.SAMASTAT_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const out = opt('--out', path.join(here, '..', 'eval', 'report.json'));
const questions = JSON.parse(fs.readFileSync(path.join(here, '..', 'eval', 'questions.json'), 'utf8')) as Question[];

type Verdict = 'correct' | 'no_data_correct' | 'partial' | 'wrong' | 'missed' | 'service_error';

const results: { question: string; verdict: Verdict; status: string; cited: string[]; expected: string[]; answer: string; latencyMs: number; guard: string | null; note?: string }[] = [];

for (const q of questions) {
  let res: AskResponse;
  try {
    const r = await fetch(`${api}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: q.question }),
      signal: AbortSignal.timeout(180_000),
    });
    res = (await r.json()) as AskResponse;
  } catch (err) {
    results.push({ question: q.question, verdict: 'service_error', status: 'error', cited: [], expected: q.expected_indicator_ids, answer: (err as Error).message, latencyMs: 0, guard: null, note: q.note });
    continue;
  }
  const cited = res.data.map((d) => d.indicatorId);
  const expected = q.expected_indicator_ids;
  let verdict: Verdict;
  if (res.status === 'error') verdict = 'service_error';
  else if (expected.length === 0) verdict = cited.length === 0 ? 'no_data_correct' : 'wrong';
  else if (cited.length === 0) verdict = 'missed';
  else {
    const hit = expected.filter((id) => cited.includes(id)).length;
    const extra = cited.filter((id) => !expected.includes(id)).length;
    verdict = hit === expected.length && extra === 0 ? 'correct' : hit > 0 ? 'partial' : 'wrong';
  }
  results.push({ question: q.question, verdict, status: res.status, cited, expected, answer: res.answer, latencyMs: res.meta.latencyMs, guard: res.meta.guard, note: q.note });
  console.log(`${verdict.padEnd(16)} ${q.question}`);
}

const count = (v: Verdict) => results.filter((r) => r.verdict === v).length;
const total = results.length;
const summary = {
  api,
  ranAt: new Date().toISOString(),
  total,
  correct: count('correct'),
  noDataCorrect: count('no_data_correct'),
  partial: count('partial'),
  wrong: count('wrong'),
  missed: count('missed'),
  serviceError: count('service_error'),
  guardFallbacks: results.filter((r) => r.guard === 'fallback').length,
};
const pct = (n: number) => `${((100 * n) / total).toFixed(0)} %`;
console.log('\nRésumé');
console.log(`  justes                : ${summary.correct + summary.noDataCorrect}/${total} (${pct(summary.correct + summary.noDataCorrect)}) dont non-réponses assumées ${summary.noDataCorrect}`);
console.log(`  partielles            : ${summary.partial} (${pct(summary.partial)})`);
console.log(`  erronées              : ${summary.wrong} (${pct(summary.wrong)})`);
console.log(`  manquées (no_data à tort) : ${summary.missed} (${pct(summary.missed)})`);
console.log(`  erreurs de service    : ${summary.serviceError}`);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ summary, results }, null, 2) + '\n');
console.log(`rapport : ${out}`);
process.exit(summary.serviceError === total ? 1 : 0);
