-- Fase 3 — Historial de cambios de precio (precio base y tarifas por temporada).
-- Escrito por las RPC de precios (023). Append-only.

create type public.price_change_type as enum (
  'base_price',
  'rate_create',
  'rate_update',
  'rate_remove'
);

create table public.price_change_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  property_rate_id uuid references public.property_rates (id) on delete set null,
  change_type public.price_change_type not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references auth.users (id),
  reason text,
  created_at timestamptz not null default now()
);

create index price_change_history_property_idx on public.price_change_history (property_id, created_at);

-- Estado de reserva derivado: reembolso pendiente tras cancelar un pago ya cobrado.
-- No devolvemos dinero automáticamente (Fase 4 BNB); solo lo marcamos.
alter type public.booking_payment_status add value if not exists 'refund_required';
