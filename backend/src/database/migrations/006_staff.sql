-- Comptes du personnel ANSD : accès au tableau de bord d'usage et aux routes d'administration.
-- Mot de passe haché (scrypt) ; jamais de mot de passe en clair. Création par `npm run staff:add`.
CREATE TABLE IF NOT EXISTS staff_users (
  id            serial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'analyste',   -- analyste | admin
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
