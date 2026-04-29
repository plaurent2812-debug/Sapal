-- Ajout du délai de livraison au niveau produit
-- Sert de fallback quand le produit n'a pas de variantes (ou que toutes sont vides)
ALTER TABLE products ADD COLUMN IF NOT EXISTS delai text NOT NULL DEFAULT '';
