-- Módulo de personal de limpieza: cuentas que administración da de alta con usuario y
-- contraseña, y los partes de limpieza que la propia persona reporta (propiedad, fecha,
-- hora de entrada y hora de salida).
--
-- Nadie asigna turnos: el parte lo carga quien limpió. Un parte no reserva, no bloquea
-- disponibilidad ni toca precios, igual que el módulo de copropietarios.

create table public.cleaner_accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cleaner_accounts_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  constraint cleaner_accounts_full_name_not_empty check (length(btrim(full_name)) > 0)
);

-- Guarda copia congelada del usuario, el nombre y la propiedad: renombrar la cuenta o la
-- propiedad después no altera lo ya reportado.
create table public.cleaning_reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.cleaner_accounts (id) on delete restrict,
  property_id uuid references public.properties (id) on delete set null,
  username text not null,
  full_name text not null,
  property_name text not null,
  work_date date not null,
  entry_time time not null,
  exit_time time not null,
  created_at timestamptz not null default now(),
  constraint cleaning_reports_range_check check (exit_time > entry_time)
);

create index cleaning_reports_date_idx on public.cleaning_reports (work_date desc);
create index cleaning_reports_account_idx on public.cleaning_reports (account_id);
create index cleaning_reports_property_idx on public.cleaning_reports (property_id, work_date);

create trigger set_updated_at
before update on public.cleaner_accounts
for each row
execute function public.set_updated_at();

-- ---------- RLS ----------
-- Staff lee todo; cada persona de limpieza solo lo suyo. Sin políticas de escritura: el
-- panel escribe con service_role y el parte entra por la RPC de abajo.

alter table public.cleaner_accounts enable row level security;
alter table public.cleaning_reports enable row level security;

create policy cleaner_accounts_read on public.cleaner_accounts
  for select using (public.is_staff() or id = auth.uid());

create policy cleaning_reports_read on public.cleaning_reports
  for select using (public.is_staff() or account_id = auth.uid());

-- ---------- Reporte de limpieza ----------
-- La cuenta sale de auth.uid(), no del cliente, y la copia congelada la arma la función:
-- un POST manipulado no puede falsear quién reportó.

create or replace function public.register_cleaning(
  p_property_id uuid,
  p_work_date date,
  p_entry_time time,
  p_exit_time time
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
  v_full_name text;
  v_property_name text;
  v_report_id uuid;
begin
  select a.id, a.username, a.full_name
    into v_account_id, v_username, v_full_name
  from public.cleaner_accounts a
  where a.id = auth.uid() and a.is_active;
  if not found then
    raise exception 'CLEANER_INACTIVE' using errcode = 'P0001';
  end if;

  select p.name into v_property_name
  from public.properties p
  where p.id = p_property_id;
  if not found then
    raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_work_date is null or p_entry_time is null or p_exit_time is null
     or p_exit_time <= p_entry_time then
    raise exception 'INVALID_TIME_RANGE' using errcode = 'P0001';
  end if;

  insert into public.cleaning_reports (
    account_id, property_id, username, full_name, property_name,
    work_date, entry_time, exit_time
  ) values (
    v_account_id, p_property_id, v_username, v_full_name, v_property_name,
    p_work_date, p_entry_time, p_exit_time
  )
  returning id into v_report_id;

  return jsonb_build_object('reportId', v_report_id);
end;
$$;

revoke all on function public.register_cleaning(uuid, date, time, time) from public;
grant execute on function public.register_cleaning(uuid, date, time, time) to authenticated, service_role;
