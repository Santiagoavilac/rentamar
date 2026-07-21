-- Fase 3 — Bloqueos de disponibilidad administrados por staff.
--
-- Segunda fuente de indisponibilidad, separada de booking_holds (que es la fuente
-- de verdad de las reservas). Un bloqueo active impide reservar esas fechas y a la
-- inversa. La coordinación hold<->block se serializa por propiedad con
-- pg_advisory_xact_lock dentro de las RPC (ver 023). Rango semiabierto [desde, hasta).

create type public.availability_block_type as enum (
  'maintenance',
  'internal_use',
  'owner_use',
  'operational',
  'manual',
  'other'
);

create type public.availability_block_status as enum ('active', 'released', 'expired');

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  stay_range daterange not null,
  type public.availability_block_type not null default 'manual',
  status public.availability_block_status not null default 'active',
  reason text,
  created_by uuid references auth.users (id),
  released_by uuid references auth.users (id),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_blocks_range_not_empty check (not isempty(stay_range))
);

create index availability_blocks_property_idx on public.availability_blocks (property_id, stay_range);
create index availability_blocks_status_idx on public.availability_blocks (status);

-- Dos bloqueos active de la misma propiedad no pueden solaparse.
alter table public.availability_blocks
add constraint availability_blocks_no_overlap
exclude using gist (property_id with =, stay_range with &&)
where (status = 'active');

create trigger set_updated_at
before update on public.availability_blocks
for each row
execute function public.set_updated_at();
