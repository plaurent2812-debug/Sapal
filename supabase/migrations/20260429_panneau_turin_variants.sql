-- Fusion Panneau Turin : 307017 (8 A4) + 307018 (18 A4) → 2 variantes du produit 307017
-- Pattern Vitrine 2000 : pas de produit 307018 dans products, uniquement des variantes.

-- 1. Ajouter les colonnes manquantes sur product_variants
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS tech_sheet_url text;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS purchase_price numeric;

-- 2. Insérer les 2 variantes
INSERT INTO product_variants (
  product_id, reference, label, dimensions, finition, coloris, poids,
  price, purchase_price, delai, tech_sheet_url, specifications, images, primary_image_url
) VALUES
  ('307017', '307017',
   '8 A4 - H 960 x 960 mm', '8 A4 - H 960 x 960 mm', '', '', '60 kg',
   824.00, 576.80, '5 semaines',
   'https://procity.eu/fr/pim-pse/pdf/966130',
   '{}'::jsonb, '[]'::jsonb, NULL),
  ('307017', '307018',
   '18 A4 - H 1300 x 1300 mm', '18 A4 - H 1300 x 1300 mm', '', '', '110 kg',
   1107.00, 775.90, '5 semaines',
   'https://procity.eu/fr/pim-pse/pdf/966131',
   '{}'::jsonb, '[]'::jsonb, NULL);
