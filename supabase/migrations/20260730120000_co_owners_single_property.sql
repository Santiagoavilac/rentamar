-- Reforma del módulo de copropietarios: la propiedad y la cantidad de habitaciones son
-- atributos de la cuenta, que administración crea de una sola vez en /admin/users. Por eso
-- desaparece el concepto de "unidad" y con él dos tablas.
--
-- Migración hacia adelante: las tablas de la primera pasada estaban vacías, así que las que
-- sobran se borran en vez de intentar migrarlas.

drop function if exists public.register_co_owner_stay(uuid, text, text, text, timestamptz, timestamptz, int, int);
drop table if exists public.co_owner_stays;
-- La política de lectura de propiedades referencia co_owner_units, así que cae primero.
drop policy if exists co_owner_properties_read on public.co_owner_properties;
drop table if exists public.co_owner_units;
drop table if exists public.co_owner_properties;

alter table public.co_owner_accounts
  add column property_name text not null,
  add column room_count int not null,
  add constraint co_owner_accounts_property_not_empty check (length(btrim(property_name)) > 0),
  add constraint co_owner_accounts_room_count_check check (room_count >= 1);

-- Guarda copia congelada del usuario, la propiedad y las habitaciones: renombrar la cuenta
-- o la propiedad después no altera lo ya declarado.
create table public.co_owner_stays (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.co_owner_accounts (id) on delete restrict,
  username text not null,
  property_name text not null,
  room_count int not null,
  full_name text not null,
  document_id text not null,
  phone text not null,
  check_in_at timestamptz not null,
  check_out_at timestamptz not null,
  adults int not null,
  minors int not null default 0,
  created_at timestamptz not null default now(),
  constraint co_owner_stays_guests_check check (adults >= 1 and minors >= 0),
  constraint co_owner_stays_range_check check (check_out_at > check_in_at)
);

create index co_owner_stays_created_idx on public.co_owner_stays (created_at desc);
create index co_owner_stays_account_idx on public.co_owner_stays (account_id);
create index co_owner_stays_property_idx on public.co_owner_stays (property_name);

-- Staff lee todo; el copropietario solo lo suyo. Sin políticas de escritura: el panel
-- escribe con service_role y el copropietario por la RPC de abajo.
alter table public.co_owner_stays enable row level security;

create policy co_owner_stays_read on public.co_owner_stays
  for select using (public.is_staff() or account_id = auth.uid());

-- ---------- Registro de estadía ----------
-- La cuenta sale de auth.uid(), no del cliente, y la copia congelada la arma la función:
-- un POST manipulado no puede falsear el usuario ni la propiedad.

create or replace function public.register_co_owner_stay(
  p_full_name text,
  p_document_id text,
  p_phone text,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
  p_adults int,
  p_minors int
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_id uuid;
  v_username text;
  v_property_name text;
  v_room_count int;
  v_stay_id uuid;
begin
  select a.id, a.username, a.property_name, a.room_count
    into v_account_id, v_username, v_property_name, v_room_count
  from public.co_owner_accounts a
  where a.id = auth.uid() and a.is_active;
  if not found then
    raise exception 'CO_OWNER_INACTIVE' using errcode = 'P0001';
  end if;

  if p_check_out_at is null or p_check_in_at is null or p_check_out_at <= p_check_in_at then
    raise exception 'INVALID_STAY_RANGE' using errcode = 'P0001';
  end if;

  if coalesce(p_adults, 0) < 1 or coalesce(p_minors, 0) < 0 then
    raise exception 'INVALID_GUEST_COUNT' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p_full_name, ''))) = 0
     or length(btrim(coalesce(p_document_id, ''))) = 0
     or length(btrim(coalesce(p_phone, ''))) = 0 then
    raise exception 'MISSING_GUEST_DATA' using errcode = 'P0001';
  end if;

  insert into public.co_owner_stays (
    account_id, username, property_name, room_count,
    full_name, document_id, phone, check_in_at, check_out_at, adults, minors
  ) values (
    v_account_id, v_username, v_property_name, v_room_count,
    btrim(p_full_name), btrim(p_document_id), btrim(p_phone),
    p_check_in_at, p_check_out_at, p_adults, coalesce(p_minors, 0)
  )
  returning id into v_stay_id;

  return jsonb_build_object('stayId', v_stay_id);
end;
$$;

revoke all on function public.register_co_owner_stay(text, text, text, timestamptz, timestamptz, int, int) from public;
grant execute on function public.register_co_owner_stay(text, text, text, timestamptz, timestamptz, int, int) to authenticated, service_role;
