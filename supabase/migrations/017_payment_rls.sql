-- Fase 2 — RLS de pagos. Todas las escrituras pasan por RPC/cliente admin
-- (service_role bypassea RLS), nunca por anon/authenticated directamente.

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.mock_payment_state enable row level security;

-- ---------- payments ----------
-- El usuario autenticado ve solo los pagos de sus propias reservas. Los pagos de
-- invitado se acceden por token vía cliente admin server-only. Sin INSERT/UPDATE
-- para anon/authenticated: la orquestación pasa exclusivamente por las RPC.
create policy payments_select_own on public.payments
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.guest_id = auth.uid()
    )
  );

-- Columnas sensibles nunca visibles para el cliente (crudo del proveedor y clave
-- de idempotencia). Solo accesibles vía service_role, que bypassea RLS y estos grants.
revoke select (create_response_raw, last_status_response_raw, idempotency_key)
  on public.payments from anon, authenticated;

-- ---------- payment_events ----------
-- Bitácora interna: solo staff (o service role). El público nunca la lee.
create policy payment_events_staff_read on public.payment_events
  for select using (public.is_staff());

-- ---------- mock_payment_state ----------
-- Estado privado del proveedor mock: nunca expuesto al cliente. Solo staff/servicio.
create policy mock_payment_state_staff_read on public.mock_payment_state
  for select using (public.is_staff());
