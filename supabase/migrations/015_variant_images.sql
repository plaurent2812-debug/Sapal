-- supabase/migrations/015_variant_images.sql
-- Ajoute un tableau d'URLs d'images par variante (stockées dans Supabase Storage)
alter table product_variants
  add column if not exists images jsonb not null default '[]';

comment on column product_variants.images is
  'Array of image URLs (Supabase Storage public URLs), ordered: first = image principale';
