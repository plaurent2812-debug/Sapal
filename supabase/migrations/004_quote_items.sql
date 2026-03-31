-- ============================================
-- Migration: Création table relationnelle quote_items
-- ============================================

-- Creation de la table pour les articles du devis (remplace le JSONB)
create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  product_id text not null references products(id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

-- Securite RLS
alter table quote_items enable row level security;
create policy "Insertion anonyme quote_items" on quote_items for insert with check (true);

-- Index pour la performance
create index idx_quote_items_quote_id on quote_items(quote_id);
create index idx_quote_items_product_id on quote_items(product_id);

-- Transfert des données existantes (de JSONB vers Relationnel)
-- Notes: Si la table quotes est vide, cela ne fera rien.
insert into quote_items (quote_id, product_id, product_name, quantity)
select 
  q.id as quote_id,
  (item->>'productId')::text as product_id,
  (item->>'productName')::text as product_name,
  (item->>'quantity')::integer as quantity
from 
  quotes q,
  jsonb_array_elements(q.items) as item;

-- Optionnel: Supprimer la colonne JSONB pour garder la BDD propre
alter table quotes drop column if exists items;
