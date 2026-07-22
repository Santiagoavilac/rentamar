-- Bucket de Storage para las imágenes base de los mapas (masterplan).
-- Lectura pública (el visor y la futura app Flutter usan una URL pública única);
-- escritura solo staff. La imagen se sube del lado del servidor con service-role.
-- La validación de MIME/tamaño se hace además en el server (acepta webp/png/jpg).

insert into storage.buckets (id, name, public)
values ('maps', 'maps', true)
on conflict (id) do nothing;

create policy "maps_public_read" on storage.objects
  for select using (bucket_id = 'maps');

create policy "maps_staff_insert" on storage.objects
  for insert with check (bucket_id = 'maps' and public.is_staff());

create policy "maps_staff_update" on storage.objects
  for update using (bucket_id = 'maps' and public.is_staff())
  with check (bucket_id = 'maps' and public.is_staff());

create policy "maps_staff_delete" on storage.objects
  for delete using (bucket_id = 'maps' and public.is_staff());
