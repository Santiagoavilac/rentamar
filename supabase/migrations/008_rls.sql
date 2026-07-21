-- Fase 1 — Row Level Security en todas las tablas públicas.
-- Sin políticas abiertas (using (true)) en tablas sensibles.
-- Las funciones SECURITY DEFINER (create_booking_with_hold, etc.) son dueñas del
-- postgres y bypassean RLS, por eso las reservas solo se insertan por esa vía.

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.amenities enable row level security;
alter table public.property_amenities enable row level security;
alter table public.property_rates enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_price_items enable row level security;
alter table public.booking_holds enable row level security;

-- ---------- profiles ----------
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_staff());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- El cambio de role lo bloquea el trigger enforce_profile_role_immutable.

-- ---------- properties ----------
create policy properties_public_read on public.properties
  for select using (status = 'published' or public.is_staff());

create policy properties_staff_write on public.properties
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- property_images ----------
create policy property_images_public_read on public.property_images
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and (p.status = 'published' or public.is_staff())
    )
  );

create policy property_images_staff_write on public.property_images
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- amenities (catálogo público) ----------
create policy amenities_public_read on public.amenities
  for select using (true);

create policy amenities_staff_write on public.amenities
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- property_amenities ----------
create policy property_amenities_public_read on public.property_amenities
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and (p.status = 'published' or public.is_staff())
    )
  );

create policy property_amenities_staff_write on public.property_amenities
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- property_rates ----------
-- Lectura pública solo para propiedades publicadas (necesario para la ficha).
create policy property_rates_public_read on public.property_rates
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and (p.status = 'published' or public.is_staff())
    )
  );

create policy property_rates_staff_write on public.property_rates
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- bookings ----------
-- El usuario autenticado ve solo sus reservas. Las de invitado se acceden por
-- token vía cliente admin server-only (que bypassea RLS). No hay INSERT/UPDATE
-- para anon/authenticated: la creación pasa exclusivamente por la RPC.
create policy bookings_select_own on public.bookings
  for select using (guest_id = auth.uid() or public.is_staff());

create policy bookings_staff_write on public.bookings
  for update using (public.is_staff()) with check (public.is_staff());

-- ---------- booking_price_items ----------
create policy booking_price_items_select_own on public.booking_price_items
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.guest_id = auth.uid()
    )
  );

-- ---------- booking_holds ----------
-- Solo staff (o service role, que bypassea RLS). El público nunca lee holds.
create policy booking_holds_staff_read on public.booking_holds
  for select using (public.is_staff());
