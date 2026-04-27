-- Fix manquant : 011_orders_system.sql crée un index sur products.supplier_id
-- mais la colonne n'est jamais ajoutée. En prod elle existe (probablement ajoutée
-- manuellement à un moment). Ajout local pour permettre `supabase start`.
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id text;
