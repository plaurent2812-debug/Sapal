-- Aligne le schéma local avec la prod (colonnes ajoutées au fil du temps en prod
-- mais sans migration locale correspondante).
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id text REFERENCES categories(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS universe text;

ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS procity_sheet text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS procity_family text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS procity_type text;
