-- 20260425_site_content.sql
-- Mode édition in-page pour l'admin : stockage key-value des contenus du site public.
--
-- Chaque ligne représente un élément éditable (titre, paragraphe, image, liste, CTA).
-- `published_value` est lisible publiquement ; `draft_value` est visible uniquement pour
-- les admins pendant l'édition. Workflow : draft → publish (promotion draft → published,
-- puis draft_value = null).

begin;

create table if not exists public.site_content (
  key text primary key,                         -- ex: 'home.hero.title'
  page text not null,                           -- ex: 'home', 'about', 'realisations', 'footer'
  published_value jsonb,                        -- valeur visible par le public
  draft_value jsonb,                            -- null si pas de brouillon en cours
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists site_content_page_idx on public.site_content(page);

-- Trigger pour updated_at
create or replace function public.set_site_content_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_site_content_updated_at();

alter table public.site_content enable row level security;

-- Lecture publique (toutes colonnes — la séparation draft/published est côté applicatif)
drop policy if exists "site_content_public_read" on public.site_content;
create policy "site_content_public_read"
  on public.site_content for select
  using (true);

-- Écriture réservée aux admins (vérifié via user_metadata.role)
drop policy if exists "site_content_admin_insert" on public.site_content;
create policy "site_content_admin_insert"
  on public.site_content for insert to authenticated
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists "site_content_admin_update" on public.site_content;
create policy "site_content_admin_update"
  on public.site_content for update to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists "site_content_admin_delete" on public.site_content;
create policy "site_content_admin_delete"
  on public.site_content for delete to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Bucket Storage pour les images uploadées via le mode édition
insert into storage.buckets (id, name, public)
values ('site-content', 'site-content', true)
on conflict (id) do nothing;

drop policy if exists "site_content_bucket_public_read" on storage.objects;
create policy "site_content_bucket_public_read"
  on storage.objects for select
  using (bucket_id = 'site-content');

drop policy if exists "site_content_bucket_admin_insert" on storage.objects;
create policy "site_content_bucket_admin_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-content'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "site_content_bucket_admin_update" on storage.objects;
create policy "site_content_bucket_admin_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'site-content'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "site_content_bucket_admin_delete" on storage.objects;
create policy "site_content_bucket_admin_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-content'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

commit;
