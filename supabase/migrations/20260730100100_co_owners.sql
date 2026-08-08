-- Módulo de copropietarios: cuentas que administración da de alta con usuario y
-- contraseña, sus unidades asignadas, y las estadías que ellos mismos declaran.
--
-- Deliberadamente separado del catálogo público: no toca properties, bookings, pagos,
-- holds ni disponibilidad. Una estadía declarada acá no reserva ni bloquea nada.

create table public.co_owner_accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint co_owner_accounts_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$')
);

create table public.co_owner_properties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint co_owner_properties_name_not_empty check (length(btrim(name)) > 0)
);

create table public.co_owner_units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.co_owner_properties (id) on delete restrict,
  label text not null,
  account_id uuid references public.co_owner_accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, label),
  constraint co_owner_units_label_not_empty check (length(btrim(label)) > 0)
);

-- Guarda copia congelada del usuario, la propiedad y la unidad: renombrar o reasignar
-- después no altera lo ya declarado.
create table public.co_owner_stays (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.co_owner_accounts (id) on delete restrict,
  unit_id uuid references public.co_owner_units (id) on delete set null,
  property_id uuid references public.co_owner_properties (id) on delete restrict,
  username text not null,
  property_name text not null,
  unit_label text not null,
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

create index co_owner_units_account_idx on public.co_owner_units (account_id);
create index co_owner_stays_created_idx on public.co_owner_stays (created_at desc);
create index co_owner_stays_account_idx on public.co_owner_stays (account_id);
create index co_owner_stays_property_idx on public.co_owner_stays (property_id);

create trigger set_updated_at
before update on public.co_owner_accounts
for each row
execute function public.set_updated_at();

create trigger set_updated_at
before update on public.co_owner_properties
for each row
execute function public.set_updated_at();

create trigger set_updated_at
before update on public.co_owner_units
for each row
execute function public.set_updated_at();

-- ---------- RLS ----------
-- Staff lee todo; el copropietario solo lo suyo. No hay políticas de escritura: las
-- altas administrativas van por service_role y la del copropietario por la RPC de abajo.

alter table public.co_owner_accounts enable row level security;
alter table public.co_owner_properties enable row level security;
alter table public.co_owner_units enable row level security;
alter table public.co_owner_stays enable row level security;

create policy co_owner_accounts_read on public.co_owner_accounts
  for select using (public.is_staff() or id = auth.uid());

create policy co_owner_units_read on public.co_owner_units
  for select using (public.is_staff() or account_id = auth.uid());

create policy co_owner_properties_read on public.co_owner_properties
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.co_owner_units u
      where u.property_id = co_owner_properties.id and u.account_id = auth.uid()
    )
  );

create policy co_owner_stays_read on public.co_owner_stays
  for select using (public.is_staff() or account_id = auth.uid());

-- ---------- Registro de estadía ----------
-- La cuenta sale de auth.uid(), no del cliente, y la copia congelada la arma la función:
-- un POST manipulado no puede falsear el usuario, la propiedad ni la unidad.

create or replace function public.register_co_owner_stay(
  p_unit_id uuid,
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
  v_property_id uuid;
  v_property_name text;
  v_unit_label text;
  v_stay_id uuid;
begin
  select a.id, a.username into v_account_id, v_username
  from public.co_owner_accounts a
  where a.id = auth.uid() and a.is_active;
  if not found then
    raise exception 'CO_OWNER_INACTIVE' using errcode = 'P0001';
  end if;

  select u.property_id, p.name, u.label into v_property_id, v_property_name, v_unit_label
  from public.co_owner_units u
  join public.co_owner_properties p on p.id = u.property_id
  where u.id = p_unit_id and u.account_id = v_account_id;
  if not found then
    raise exception 'UNIT_NOT_ASSIGNED' using errcode = 'P0002';
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
    account_id, unit_id, property_id, username, property_name, unit_label,
    full_name, document_id, phone, check_in_at, check_out_at, adults, minors
  ) values (
    v_account_id, p_unit_id, v_property_id, v_username, v_property_name, v_unit_label,
    btrim(p_full_name), btrim(p_document_id), btrim(p_phone),
    p_check_in_at, p_check_out_at, p_adults, coalesce(p_minors, 0)
  )
  returning id into v_stay_id;

  return jsonb_build_object('stayId', v_stay_id);
end;
$$;

revoke all on function public.register_co_owner_stay(uuid, text, text, text, timestamptz, timestamptz, int, int) from public;
grant execute on function public.register_co_owner_stay(uuid, text, text, text, timestamptz, timestamptz, int, int) to authenticated, service_role;
