-- Fase 3 — Índices para los listados del panel (filtros y orden server-side).
-- Los índices de audit_logs/price_change_history/booking_events/availability_blocks
-- se crean junto a sus tablas (021/022/020/019). Aquí solo bookings y payments.

create index if not exists bookings_property_checkin_idx on public.bookings (property_id, check_in);
create index if not exists bookings_created_idx on public.bookings (created_at);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_created_idx on public.payments (created_at);
