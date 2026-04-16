-- ============================================
-- Migration: Ajout colonnes variant sur quote_items
-- ============================================

ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS variant_reference text,
  ADD COLUMN IF NOT EXISTS variant_label text;
