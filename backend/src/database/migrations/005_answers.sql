-- Réponses partageables : chaque réponse contenant au moins une valeur ou une étude reçoit un
-- identifiant court et une page permanente (/r/:id sur le web). Contenu strictement public :
-- question, texte rendu, enregistrements cités. Aucune donnée personnelle.
CREATE TABLE IF NOT EXISTS answers (
  id         text PRIMARY KEY,
  response   jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS answers_created_idx ON answers (created_at DESC);
