-- Fase 1 — Perfiles + utilidades compartidas.

-- Trigger reutilizable para mantener updated_at (usado por varias tablas).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role public.user_role not null default 'guest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Helpers de rol. SECURITY DEFINER para leer profiles sin recursión de RLS.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'operator')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Un usuario no puede cambiar su propio role. Solo un admin (o el contexto
-- server con service role, donde auth.uid() es null) puede modificarlo.
create or replace function public.enforce_profile_role_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'No autorizado para cambiar el role del perfil';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_profile_role_immutable
before update on public.profiles
for each row
execute function public.enforce_profile_role_immutable();

-- Crear el profile automáticamente al registrarse un usuario de auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
