-- Fase 2 — Bitácora de eventos de pago. Append-only: nunca se borra ni actualiza.

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  source public.payment_event_source not null,
  event_type text not null,
  old_status public.payment_status,
  new_status public.payment_status,
  provider_status_code text,
  request_id text,
  metadata jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index payment_events_payment_idx on public.payment_events (payment_id);
create index payment_events_booking_idx on public.payment_events (booking_id);
create index payment_events_created_idx on public.payment_events (created_at);
