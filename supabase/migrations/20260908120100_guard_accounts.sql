-- Cuentas de los guardias de portería: usuario y contraseña que da de alta administración,
-- igual que limpieza y copropietarios.
--
-- El guardia no registra nada: su única pantalla es de consulta. Por eso la cuenta no tiene
-- tabla de registros asociada, y la única lectura que habilita es la RPC list_access_entries
-- (20260908120200_access_approvals.sql), que le devuelve nombres y estado de aprobación pero
-- nunca montos, correos ni tokens.

create table public.guard_accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guard_accounts_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  constraint guard_accounts_full_name_not_empty check (length(btrim(full_name)) > 0)
);

create trigger set_updated_at
before update on public.guard_accounts
for each row
execute function public.set_updated_at();

-- ---------- RLS ----------
-- Staff lee todo; cada guardia solo su propia cuenta. Sin políticas de escritura: el panel
-- escribe con service_role, igual que cleaner_accounts.

alter table public.guard_accounts enable row level security;

create policy guard_accounts_read on public.guard_accounts
  for select using (public.is_staff() or id = auth.uid());

-- Espejo de is_staff(): security definer para poder leer profiles y guard_accounts desde
-- las funciones de acceso sin que la RLS de esas tablas se meta en el medio.
create or replace function public.is_guard()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.guard_accounts g on g.id = p.id
    where p.id = auth.uid() and p.role = 'guard' and g.is_active
  );
$$;

-- El proyecto tiene default privileges que otorgan execute a anon y authenticated al crear
-- funciones en public, así que revocar a PUBLIC no alcanza: hay que nombrar a anon.
revoke all on function public.is_guard() from public, anon;
grant execute on function public.is_guard() to authenticated, service_role;
