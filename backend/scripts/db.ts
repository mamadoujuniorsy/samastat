import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Outils de base de données sans dépendance Nest :
 *   npm run db:migrate        → applique les fichiers SQL de src/database/migrations dans l'ordre
 *   npm run db:seed           → indicateurs de src/database/seed/indicators.json
 *   npm run db:seed:surveys   → catalogue ANADS de src/database/seed/anads-catalog.json
 *   npm run db:index          → embeddings manquants (indicateurs et enquêtes), --all pour tout recalculer
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');

for (const candidate of [path.join(backendRoot, '..', '.env'), path.join(backendRoot, '.env')]) {
  if (fs.existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant : copiez .env.example vers .env à la racine.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

async function migrate() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  const dir = path.join(backendRoot, 'src', 'database', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set(
    (await pool.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
  );
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`migration appliquée : ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  console.log('schéma à jour');
}

interface SeedIndicator {
  id: string;
  name: string;
  description?: string;
  value: number;
  unit: string;
  territory: string;
  territory_level: string;
  period: string;
  source: string;
  platform: string;
  url: string;
  keywords?: string[];
  domain?: string;
  verified_at?: string;
}

async function seed() {
  const file = path.join(backendRoot, 'src', 'database', 'seed', 'indicators.json');
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as SeedIndicator[];
  let n = 0;
  for (const r of rows) {
    if (typeof r.value !== 'number' || !r.url || !r.source) {
      throw new Error(`Indicateur ${r.id} invalide : valeur numérique, source et url obligatoires.`);
    }
    await pool.query(
      `INSERT INTO indicators
         (id, name, description, value, unit, territory, territory_level, period, source, platform, url, keywords, domain, verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description, value = EXCLUDED.value,
         unit = EXCLUDED.unit, territory = EXCLUDED.territory, territory_level = EXCLUDED.territory_level,
         period = EXCLUDED.period, source = EXCLUDED.source, platform = EXCLUDED.platform,
         url = EXCLUDED.url, keywords = EXCLUDED.keywords, domain = EXCLUDED.domain, verified_at = EXCLUDED.verified_at, updated_at = now(),
         -- le texte indexé a changé : l'embedding sera recalculé par db:index
         embedding = CASE
           WHEN indicators.name IS DISTINCT FROM EXCLUDED.name
             OR indicators.territory IS DISTINCT FROM EXCLUDED.territory
             OR indicators.period IS DISTINCT FROM EXCLUDED.period
             OR indicators.description IS DISTINCT FROM EXCLUDED.description
             OR indicators.keywords IS DISTINCT FROM EXCLUDED.keywords
           THEN NULL ELSE indicators.embedding END`,
      [
        r.id, r.name, r.description ?? null, r.value, r.unit, r.territory, r.territory_level,
        r.period, r.source, r.platform, r.url, r.keywords ?? [], r.domain ?? 'autre', r.verified_at ?? null,
      ],
    );
    n++;
  }
  console.log(`${n} indicateur(s) insérés ou mis à jour`);
}

interface SeedSurvey {
  id: number;
  idno: string;
  title: string;
  year_start?: number | null;
  year_end?: number | null;
  authoring_entity?: string | null;
  url: string;
  abstract?: string;
  keywords?: string[];
}

async function seedSurveys() {
  const file = path.join(backendRoot, 'src', 'database', 'seed', 'anads-catalog.json');
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as SeedSurvey[];
  let n = 0;
  for (const r of rows) {
    if (!r.idno || !r.title || !r.url) continue;
    await pool.query(
      `INSERT INTO surveys (idno, nada_id, title, year_start, year_end, authoring_entity, abstract, keywords, url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (idno) DO UPDATE SET
         nada_id = EXCLUDED.nada_id, title = EXCLUDED.title, year_start = EXCLUDED.year_start,
         year_end = EXCLUDED.year_end, authoring_entity = EXCLUDED.authoring_entity, url = EXCLUDED.url,
         keywords = EXCLUDED.keywords, updated_at = now(),
         abstract = EXCLUDED.abstract,
         embedding = CASE
           WHEN surveys.title IS DISTINCT FROM EXCLUDED.title OR surveys.abstract IS DISTINCT FROM EXCLUDED.abstract
           THEN NULL ELSE surveys.embedding END`,
      [
        r.idno, r.id, r.title, r.year_start ?? null, r.year_end ?? null, r.authoring_entity ?? null,
        r.abstract ?? null, r.keywords ?? [], r.url,
      ],
    );
    n++;
  }
  console.log(`${n} étude(s) ANADS insérées ou mises à jour`);
}

/** Calcule les embeddings manquants (ou tous avec --all) avec le modèle local. */
async function index(all: boolean) {
  const { createEmbedder, passageText, surveyPassageText, toVectorLiteral } = await import(
    '../src/indicators/embedding.js'
  );
  console.log('chargement du modèle d’embeddings (téléchargé au premier lancement)…');
  const embedder = await createEmbedder();
  const BATCH = 16;

  const indicators = await pool.query<{
    id: string; name: string; territory: string; period: string; description: string | null; keywords: string[];
  }>(
    `SELECT id, name, territory, period, description, keywords FROM indicators
      WHERE $1::boolean OR embedding IS NULL OR embedding_model IS DISTINCT FROM $2 ORDER BY id`,
    [all, embedder.model],
  );
  for (let i = 0; i < indicators.rows.length; i += BATCH) {
    const batch = indicators.rows.slice(i, i + BATCH);
    const vectors = await embedder.embedPassages(batch.map(passageText));
    for (let j = 0; j < batch.length; j++) {
      await pool.query('UPDATE indicators SET embedding = $1::vector, embedding_model = $2 WHERE id = $3', [
        toVectorLiteral(vectors[j]), embedder.model, batch[j].id,
      ]);
    }
    console.log(`indicateurs : ${Math.min(i + BATCH, indicators.rows.length)}/${indicators.rows.length}`);
  }

  const surveys = await pool.query<{
    idno: string; title: string; abstract: string | null; keywords: string[]; year_start: number | null; year_end: number | null;
  }>(
    `SELECT idno, title, abstract, keywords, year_start, year_end FROM surveys
      WHERE $1::boolean OR embedding IS NULL OR embedding_model IS DISTINCT FROM $2 ORDER BY idno`,
    [all, embedder.model],
  );
  for (let i = 0; i < surveys.rows.length; i += BATCH) {
    const batch = surveys.rows.slice(i, i + BATCH);
    const vectors = await embedder.embedPassages(batch.map(surveyPassageText));
    for (let j = 0; j < batch.length; j++) {
      await pool.query('UPDATE surveys SET embedding = $1::vector, embedding_model = $2 WHERE idno = $3', [
        toVectorLiteral(vectors[j]), embedder.model, batch[j].idno,
      ]);
    }
    console.log(`études : ${Math.min(i + BATCH, surveys.rows.length)}/${surveys.rows.length}`);
  }
  if (!indicators.rowCount && !surveys.rowCount) console.log('index sémantique déjà à jour');
}

const command = process.argv[2];
try {
  if (command === 'migrate') await migrate();
  else if (command === 'seed') await seed();
  else if (command === 'seed:surveys') await seedSurveys();
  else if (command === 'index') await index(process.argv.includes('--all'));
  else {
    console.error('usage : db.ts <migrate|seed|seed:surveys|index [--all]>');
    process.exit(1);
  }
} finally {
  await pool.end();
}
