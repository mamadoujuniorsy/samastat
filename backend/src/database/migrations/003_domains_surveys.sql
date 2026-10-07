-- Domaine thématique des indicateurs (tableau de bord d'usage : répartition thématique).
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT 'autre';
CREATE INDEX IF NOT EXISTS indicators_domain_idx ON indicators (domain);

-- Catalogue ANADS : métadonnées des enquêtes et recensements (aucune microdonnée).
-- Sert à orienter les utilisateurs avancés vers l'étude pertinente.
CREATE TABLE IF NOT EXISTS surveys (
  idno             text PRIMARY KEY,               -- identifiant NADA, ex. SEN-ANSD-RGPH5-2023-V1.1
  nada_id          integer NOT NULL,               -- identifiant numérique du catalogue
  title            text NOT NULL,
  year_start       integer,
  year_end         integer,
  authoring_entity text,
  abstract         text,
  keywords         text[] NOT NULL DEFAULT '{}',
  url              text NOT NULL,
  embedding        vector(384),
  embedding_model  text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  search_document  tsvector GENERATED ALWAYS AS (
    to_tsvector('french'::regconfig,
      coalesce(title, '') || ' ' || coalesce(abstract, '') || ' ' ||
      coalesce(authoring_entity, '') || ' ' || immutable_array_to_string(keywords))
  ) STORED
);
CREATE INDEX IF NOT EXISTS surveys_fts_idx ON surveys USING gin (search_document);
CREATE INDEX IF NOT EXISTS surveys_embedding_idx ON surveys USING hnsw (embedding vector_cosine_ops);

-- Journal d'usage : études citées dans une réponse.
ALTER TABLE question_log ADD COLUMN IF NOT EXISTS survey_ids text[] NOT NULL DEFAULT '{}';
