-- Comprobantes de pago subidos por el cliente y analizados por IA.
-- El bucket es PRIVADO: el comprobante puede exponer datos bancarios del cliente.
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

create policy "payment_receipts_staff_read" on storage.objects
  for select using (bucket_id = 'payment-receipts' and public.is_staff());

-- Una fila por comprobante subido. ai_result guarda la clasificación de la IA (1..4);
-- ai_status distingue una respuesta válida de una caída del proveedor de IA.
create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  file_path text not null,
  mime_type text not null,
  size_bytes integer not null,
  sha256 text not null,
  ai_result smallint check (ai_result between 1 and 4),
  ai_status text not null default 'analyzed' check (ai_status in ('analyzed', 'unavailable')),
  attempt_no int not null,
  created_at timestamptz not null default now()
);

create index payment_receipts_payment_idx on public.payment_receipts (payment_id);

-- Deduplicación: el mismo archivo (por hash) no puede reutilizarse para otro pago.
-- El servidor consulta por hash antes de insertar y, si ya existe, manda a revisión.
create unique index payment_receipts_sha_idx on public.payment_receipts (sha256);

-- ---------- RLS ----------
-- Solo lectura y solo staff. La subida y la lectura de archivos pasan por service_role.
alter table public.payment_receipts enable row level security;

create policy payment_receipts_staff_read on public.payment_receipts
  for select using (public.is_staff());
