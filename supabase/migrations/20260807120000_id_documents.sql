-- Carnet de identidad (anverso/reverso) subido en el flujo de afiliados.
-- Contiene datos personales sensibles, así que el bucket es PRIVADO igual que `declarations`:
-- sin políticas de escritura (sube el servidor con service_role) y lectura solo para staff.
-- Al staff se le entregan los archivos mediante URLs firmadas de corta duración.

insert into storage.buckets (id, name, public)
values ('id-documents', 'id-documents', false)
on conflict (id) do nothing;

create policy "id_documents_staff_read" on storage.objects
  for select using (bucket_id = 'id-documents' and public.is_staff());

-- Una fila por imagen (anverso o reverso) asociada a una reserva.
create table public.id_documents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  side text not null check (side in ('front', 'back')),
  file_path text not null,
  mime_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),
  -- A lo sumo un anverso y un reverso por reserva.
  constraint id_documents_unique_side unique (booking_id, side)
);

create index id_documents_booking_idx on public.id_documents (booking_id);

-- ---------- RLS ----------
-- Solo lectura y solo staff. El afiliado es anónimo: las imágenes se suben con service_role
-- y nunca se le devuelven.
alter table public.id_documents enable row level security;

create policy id_documents_staff_read on public.id_documents
  for select using (public.is_staff());
