-- Date à laquelle la valeur a été relue sur la page ANSD (traçabilité, affichée dans les fiches).
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS verified_at date;
