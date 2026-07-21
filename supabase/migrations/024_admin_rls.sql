-- Fase 3 — RLS de las tablas administrativas nuevas.
-- Sin using(true) en tablas sensibles. Toda escritura pasa por RPC/cliente admin
-- (service_role bypassea RLS); no hay INSERT/UPDATE/DELETE para anon/authenticated.

alter table public.availability_blocks enable row level security;
alter table public.booking_events enable row level security;
alter table public.price_change_history enable row level security;
alter table public.audit_logs enable row level security;

-- availability_blocks: staff lee; sin escritura directa (todo por RPC).
create policy availability_blocks_staff_read on public.availability_blocks
  for select using (public.is_staff());

-- booking_events: staff lee; sin insert de cliente.
create policy booking_events_staff_read on public.booking_events
  for select using (public.is_staff());

-- price_change_history: staff lee; solo el sistema inserta.
create policy price_change_history_staff_read on public.price_change_history
  for select using (public.is_staff());

-- audit_logs: SOLO admin lee. Sin insert/update/delete de cliente (append-only
-- vía service_role). No editable ni borrable desde el panel.
create policy audit_logs_admin_read on public.audit_logs
  for select using (public.is_admin());
