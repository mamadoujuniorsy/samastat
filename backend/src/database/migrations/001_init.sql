-- Jalon 1 : jeu de test d'indicateurs réels ANSD + journal d'usage anonymisé.
-- Toute valeur affichée à l'utilisateur provient d'une ligne de la table `indicators`.

-- array_to_string n'est que STABLE ; une colonne générée exige une fonction IMMUTABLE.
CREATE OR REPLACE FUNCTION immutable_array_to_string(text[])
  RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT array_to_string($1, ' ') $$;

CREATE TABLE IF NOT EXISTS indicators (
  id              text PRIMARY KEY,                 -- identifiant stable, ex. rgph5-2023-population-region-dakar
  name            text NOT NULL,                    -- intitulé de l'indicateur
  description     text,                             -- précision méthodologique éventuelle
  value           numeric NOT NULL,                 -- valeur numérique brute
  unit            text NOT NULL,                    -- ex. habitants, %, FCFA
  territory       text NOT NULL,                    -- ex. Sénégal, Région de Dakar
  territory_level text NOT NULL,                    -- national | region | departement | commune
  period          text NOT NULL,                    -- ex. 2023, 2021-2022, T1 2026
  source          text NOT NULL,                    -- ex. ANSD — RGPH-5 (2023), résultats définitifs
  platform        text NOT NULL,                    -- ex. ansd.sn, senegal.opendataforafrica.org
  url             text NOT NULL,                    -- page exacte où la valeur a été relevée
  keywords        text[] NOT NULL DEFAULT '{}',     -- synonymes pour la recherche
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Document de recherche plein texte (français) : nom + territoire + description + mots-clés.
  search_document tsvector GENERATED ALWAYS AS (
    to_tsvector('french'::regconfig,
      coalesce(name, '') || ' ' || coalesce(territory, '') || ' ' ||
      coalesce(description, '') || ' ' || immutable_array_to_string(keywords))
  ) STORED
);

CREATE INDEX IF NOT EXISTS indicators_fts_idx ON indicators USING gin (search_document);

-- Journal d'usage anonymisé : aucune donnée personnelle, uniquement la question et l'issue.
CREATE TABLE IF NOT EXISTS question_log (
  id            bigserial PRIMARY KEY,
  question      text NOT NULL,
  status        text NOT NULL,                      -- answered | no_data | conversation | error
  indicator_ids text[] NOT NULL DEFAULT '{}',
  guard_result  text,                               -- passed | fallback
  model         text,
  latency_ms    integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);
