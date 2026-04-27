-- 20260421_procity_mirror.sql
-- Enrichissement du schéma pour le miroir catalogue Procity
-- Stratégie : ajouts idempotents uniquement (IF NOT EXISTS partout)
-- Ne recrée rien d'existant (suppliers/products/product_variants sont en place).

begin;

-- 1. Enrichir suppliers (colonnes orientées catalogue, vs les colonnes commerciales existantes)
alter table public.suppliers
  add column if not exists website text,
  add column if not exists logo_url text,
  add column if not exists default_availability text,
  add column if not exists scraper_config jsonb default '{}'::jsonb;

update public.suppliers
set website = coalesce(website, 'https://procity.eu'),
    default_availability = coalesce(default_availability, 'Délai à confirmer')
where slug = 'procity';

-- 2. Enrichir products (données scraper)
alter table public.products
  add column if not exists description_sapal text,
  add column if not exists description_source_hash text,
  add column if not exists tech_sheet_url text,
  add column if not exists gallery_image_urls text[] default '{}',
  add column if not exists procity_url text,
  add column if not exists last_scraped_at timestamptz;

-- 3. Enrichir product_variants
alter table public.product_variants
  add column if not exists primary_image_url text;

-- 4. Contrainte unique pour upsert idempotent des variantes
-- Clé naturelle : (product_id, reference, coloris, finition) car plusieurs variantes
-- peuvent partager une même ref Procity avec des coloris/finitions différents.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_variants_natural_key_unique'
      and conrelid = 'public.product_variants'::regclass
  ) then
    alter table public.product_variants
      add constraint product_variants_natural_key_unique
      unique (product_id, reference, coloris, finition);
  end if;
end$$;

-- 5. Table scrape_runs (observatoire admin)
create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  supplier_id text not null references public.suppliers(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','completed','failed','pending_review','applied','rejected')),
  stats jsonb default '{}'::jsonb,
  diff_payload jsonb,
  created_by uuid references auth.users(id)
);

create index if not exists idx_scrape_runs_supplier_status
  on public.scrape_runs (supplier_id, status);

alter table public.scrape_runs enable row level security;

drop policy if exists "scrape_runs_admin_only" on public.scrape_runs;
create policy "scrape_runs_admin_only" on public.scrape_runs
  for all using (
    (auth.jwt() ->> 'role') = 'admin'
    or auth.role() = 'service_role'
  );

commit;
