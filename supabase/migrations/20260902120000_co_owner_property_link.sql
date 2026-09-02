-- Vincula la cuenta del copropietario con la propiedad publicada, para que pueda ver las
-- reservas de su departamento. Queda nullable: las cuentas existentes siguen andando y el
-- listado de reservas simplemente no se ofrece hasta que administración las vincule.

alter table public.co_owner_accounts
  add column if not exists property_id uuid references public.properties (id) on delete set null;

create index if not exists co_owner_accounts_property_idx
  on public.co_owner_accounts (property_id);

-- Espeja a is_staff(): security definer para leer co_owner_accounts desde la política de
-- bookings sin que su propia RLS se meta en el medio.
create or replace function public.is_co_owner_of(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.co_owner_accounts a
    where a.id = auth.uid()
      and a.is_active
      and a.property_id = p_property_id
  );
$$;

-- El grant por defecto es a PUBLIC, así que revocar solo a anon no alcanza. La política de
-- bookings se evalúa con el rol que consulta: authenticated conserva el execute.
revoke execute on function public.is_co_owner_of(uuid) from public;
grant execute on function public.is_co_owner_of(uuid) to authenticated, service_role;

-- El copropietario suma a lo que ya veía cada quien: sus propias reservas y las del staff.
drop policy if exists bookings_select_own on public.bookings;
create policy bookings_select_own on public.bookings
  for select using (
    guest_id = auth.uid()
    or public.is_staff()
    or public.is_co_owner_of(property_id)
  );
