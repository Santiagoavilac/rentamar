-- Fase 2 — Pagos. Montos en unidad menor (bigint), nunca float.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  provider public.payment_provider not null,
  provider_mode text,
  method public.payment_method not null default 'qr',
  status public.payment_status not null default 'created',
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'BOB',
  external_id text,
  external_qr_code text,
  provider_status_code text,
  qr_image_base64 text,
  qr_mime_type text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  failed_at timestamptz,
  last_provider_check_at timestamptz,
  idempotency_key text not null unique,
  create_response_raw jsonb,
  last_status_response_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_booking_idx on public.payments (booking_id);
create index payments_status_idx on public.payments (status);
create index payments_external_idx on public.payments (external_id);

-- Anti-duplicado a nivel de base: a lo sumo un pago activo por reserva.
create unique index payments_one_active_per_booking
  on public.payments (booking_id)
  where (status in ('created', 'pending'));

create trigger set_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();
