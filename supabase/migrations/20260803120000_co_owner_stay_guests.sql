-- Huéspedes declarados en una estadía de copropietario.
-- El huésped 1 es quien firma la declaración jurada y sigue viviendo en co_owner_stays
-- (full_name, document_id, phone) para no tener que recrear register_co_owner_stay ni
-- tocar las páginas de admin que ya leen esas columnas. Acá van del segundo en adelante.

-- Nullable: las estadías registradas antes de este cambio no tienen la fecha.
alter table public.co_owner_stays add column birth_date date;

create table public.co_owner_stay_guests (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.co_owner_stays (id) on delete cascade,
  full_name text not null,
  document_id text not null,
  phone text,
  birth_date date not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index co_owner_stay_guests_stay_idx on public.co_owner_stay_guests (stay_id, sort_order);

alter table public.co_owner_stay_guests enable row level security;

-- Espeja co_owner_stays_read: el staff ve todo, el copropietario solo lo suyo.
-- La escritura la hace el servidor con service-role, así que no hay política de insert.
create policy "co_owner_stay_guests_read" on public.co_owner_stay_guests
  for select using (
    public.is_staff()
    or exists (
      select 1
      from public.co_owner_stays s
      where s.id = co_owner_stay_guests.stay_id and s.account_id = auth.uid()
    )
  );
