-- Jalon 2 : index sémantique. L'embedding est calculé localement (modèle multilingue e5-small,
-- 384 dimensions) par `npm run db:index`. NULL tant qu'un indicateur n'a pas été indexé.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE indicators ADD COLUMN IF NOT EXISTS embedding vector(384);
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS embedding_model text;

CREATE INDEX IF NOT EXISTS indicators_embedding_idx
  ON indicators USING hnsw (embedding vector_cosine_ops);

-- Jalon 5 : langue détectée de la question (fr, wo, unknown) pour le tableau de bord d'usage.
ALTER TABLE question_log ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE question_log ADD COLUMN IF NOT EXISTS cached boolean NOT NULL DEFAULT false;
