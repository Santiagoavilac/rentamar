-- Fase 3 — Bucket de Storage para imágenes de propiedades.
-- Lectura pública (las fichas muestran las imágenes); escritura solo staff.
-- La validación de MIME/tamaño/extensión se hace además en el server (rechaza SVG;
-- acepta jpg/jpeg/png/webp; no confía en la extensión declarada).

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

create policy "property_images_public_read" on storage.objects
  for select using (bucket_id = 'property-images');

create policy "property_images_staff_insert" on storage.objects
  for insert with check (bucket_id = 'property-images' and public.is_staff());

create policy "property_images_staff_update" on storage.objects
  for update using (bucket_id = 'property-images' and public.is_staff())
  with check (bucket_id = 'property-images' and public.is_staff());

create policy "property_images_staff_delete" on storage.objects
  for delete using (bucket_id = 'property-images' and public.is_staff());
