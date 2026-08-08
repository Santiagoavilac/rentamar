-- Declaración Jurada de Responsabilidad emitida para una reserva o para una estadía de
-- copropietario. Una fila por documento emitido.
--
-- data_snapshot congela los datos exactos con los que se generó el PDF: si después cambia
-- el teléfono o el nombre, la declaración ya emitida no se transforma en otro documento.
-- Por eso el endpoint devuelve el archivo guardado en vez de regenerarlo.

create table public.declarations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete cascade,
  stay_id uuid references public.co_owner_stays (id) on delete cascade,
  accepted_at timestamptz not null,
  generated_at timestamptz not null default now(),
  pdf_path text not null,
  document_version text not null,
  data_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  -- Apunta exactamente a una reserva o a una estadía, nunca a las dos ni a ninguna.
  constraint declarations_target_check check (num_nonnulls(booking_id, stay_id) = 1)
);

-- Una sola declaración vigente por reserva o estadía: es lo que hace que el documento
-- quede congelado en vez de regenerarse distinto en cada descarga.
create unique index declarations_booking_idx
  on public.declarations (booking_id) where booking_id is not null;
create unique index declarations_stay_idx
  on public.declarations (stay_id) where stay_id is not null;

-- ---------- RLS ----------
-- Solo lectura y solo staff. El huésped no tiene sesión: su acceso pasa por el endpoint,
-- que valida el token de la reserva y luego lee con service_role.

alter table public.declarations enable row level security;

create policy declarations_staff_read on public.declarations
  for select using (public.is_staff());
