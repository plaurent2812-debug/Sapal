create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  reference text not null,
  label text not null,
  dimensions text not null default '',
  finition text not null default '',
  coloris text not null default '',
  poids text not null default '',
  price numeric not null default 0,
  delai text not null default '',
  specifications jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_product_variants_product on product_variants(product_id);
alter table product_variants enable row level security;
create policy "Lecture publique variants" on product_variants for select using (true);
