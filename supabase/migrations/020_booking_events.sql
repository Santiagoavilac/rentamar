-- Fase 3 — Bitácora append-only de eventos de reserva (ciclo de vida operativo).
-- No duplica payment_events (que cubre el detalle del cobro). Aquí se registran
-- transiciones de estado hechas por staff o el sistema: cancelación, expiración,
-- revisión manual, confirmación manual, liberación de hold, notas.

create type public.booking_event_source as enum (
  'system',
  'guest',
  'admin',
  'operator',
  'payment',
  'expiration'
);

create type public.booking_event_type as enum (
  'created',
  'status_changed',
  'cancelled',
  'expired',
  'manual_review',
  'confirmed_manual',
  'hold_released',
  'refund_required',
  'note'
);

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  actor_id uuid references auth.users (id),
  source public.booking_event_source not null,
  event_type public.booking_event_type not null,
  old_status public.booking_status,
  new_status public.booking_status,
  metadata jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, created_at);
