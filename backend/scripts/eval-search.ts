import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createEmbedder, toVectorLiteral } from '../src/indicators/embedding.js';
import { lexiconHits } from '../src/assistant/wolof.js';

/**
 * Évaluation du moteur de correspondance seul, sans modèle de langage ni clé API :
 * pour chaque question de eval/questions.json ayant des enregistrements attendus, la recherche
 * hybride (vecteur + plein texte) est lancée sur la question brute (plus les indices du lexique
 * wolof) et l'on mesure si les attendus figurent dans les 3 et les 10 premiers résultats.
 *
 *   npm run eval:search
 */
const here = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [path.join(here, '..', '..', '.env'), path.join(here, '..', '.env')]) {
  if (fs.existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

interface Question {
  question: string;
  expected_indicator_ids: string[];
  note?: string;
}

const questions = (JSON.parse(fs.readFileSync(path.join(here, '..', 'eval', 'questions.json'), 'utf8')) as Question[]).filter(
  (q) => q.expected_indicator_ids.length > 0,
);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const embedder = await createEmbedder();

let top3 = 0;
let top10 = 0;
let mrr = 0;
const rows: { question: string; rank: number | null; top: string[] }[] = [];

for (const q of questions) {
  const hints = lexiconHits(q.question).map((h) => h.french).join(' ');
  const query = hints ? `${q.question} ${hints}` : q.question;
  const vector = await embedder.embedQuery(query);
  const res = await pool.query<{ id: string }>(
    `SELECT id FROM indicators
      ORDER BY (0.7 * coalesce(1 - (embedding <=> $1::vector), 0)
              + 0.3 * least(ts_rank(search_document, plainto_tsquery('french', $2)), 1)) DESC
      LIMIT 10`,
    [toVectorLiteral(vector), query],
  );
  const ids = res.rows.map((r) => r.id);
  const ranks = q.expected_indicator_ids.map((e) => ids.indexOf(e)).filter((r) => r >= 0);
  const best = ranks.length ? Math.min(...ranks) : null;
  if (best !== null && best < 3) top3++;
  if (best !== null) top10++;
  if (best !== null) mrr += 1 / (best + 1);
  rows.push({ question: q.question, rank: best === null ? null : best + 1, top: ids.slice(0, 3) });
  console.log(`${best === null ? 'absent ' : `rang ${String(best + 1).padStart(2)}`}  ${q.question}`);
}

const n = questions.length;
console.log('\nMoteur de correspondance (sans modèle de langage)');
console.log(`  attendu dans le top 3  : ${top3}/${n} (${((100 * top3) / n).toFixed(0)} %)`);
console.log(`  attendu dans le top 10 : ${top10}/${n} (${((100 * top10) / n).toFixed(0)} %)`);
console.log(`  rang réciproque moyen  : ${(mrr / n).toFixed(2)}`);
fs.writeFileSync(
  path.join(here, '..', 'eval', 'report-search.json'),
  JSON.stringify({ ranAt: new Date().toISOString(), n, top3, top10, mrr: mrr / n, rows }, null, 2) + '\n',
);
await pool.end();
