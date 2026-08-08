-- Bucket para los PDF de declaración jurada. A diferencia de `maps` y `property-images`,
-- este es PRIVADO: cada archivo contiene cédula de identidad y teléfono, así que no puede
-- quedar detrás de una URL pública permanente.
--
-- Sin políticas de escritura: sube el servidor con service_role. La lectura por política
-- es solo para staff; al huésped se le entregan los bytes desde el endpoint tras validar
-- el token de su reserva.

insert into storage.buckets (id, name, public)
values ('declarations', 'declarations', false)
on conflict (id) do nothing;

create policy "declarations_staff_read" on storage.objects
  for select using (bucket_id = 'declarations' and public.is_staff());
