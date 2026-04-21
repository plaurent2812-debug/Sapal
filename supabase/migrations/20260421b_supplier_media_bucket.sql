-- 20260421b_supplier_media_bucket.sql
-- Bucket Storage dédié aux médias fournisseurs (photos galerie, images par variante, PDF techniques).
-- Lecture publique, écriture réservée au service_role (scripts Node d'import).

begin;

insert into storage.buckets (id, name, public)
values ('supplier-media', 'supplier-media', true)
on conflict (id) do nothing;

drop policy if exists "supplier_media_public_read" on storage.objects;
create policy "supplier_media_public_read"
  on storage.objects for select
  using (bucket_id = 'supplier-media');

drop policy if exists "supplier_media_service_write" on storage.objects;
create policy "supplier_media_service_write"
  on storage.objects for insert
  with check (bucket_id = 'supplier-media' and auth.role() = 'service_role');

drop policy if exists "supplier_media_service_update" on storage.objects;
create policy "supplier_media_service_update"
  on storage.objects for update
  using (bucket_id = 'supplier-media' and auth.role() = 'service_role');

drop policy if exists "supplier_media_service_delete" on storage.objects;
create policy "supplier_media_service_delete"
  on storage.objects for delete
  using (bucket_id = 'supplier-media' and auth.role() = 'service_role');

commit;
