-- Fase 1 — Propiedades, imágenes, amenities y tarifas.
-- Dinero siempre en unidad menor (_minor, bigint). Bs 500,00 => 50000. Nunca float.

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  property_type text,
  status public.property_status not null default 'draft',
  zone text,
  max_guests int not null default 1 check (max_guests > 0),
  bedrooms int not null default 0 check (bedrooms >= 0),
  beds int not null default 0 check (beds >= 0),
  bathrooms int not null default 0 check (bathrooms >= 0),
  base_price_minor bigint not null check (base_price_minor >= 0),
  currency text not null default 'BOB',
  minimum_nights int not null default 1 check (minimum_nights > 0),
  check_in_time time not null default '15:00',
  check_out_time time not null default '11:00',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_status_idx on public.properties (status);
create index properties_featured_idx on public.properties (featured) where status = 'published';

create trigger set_updated_at
before update on public.properties
for each row
execute function public.set_updated_at();

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index property_images_property_idx on public.property_images (property_id, sort_order);
-- Solo una imagen cover por propiedad.
create unique index property_images_one_cover_idx on public.property_images (property_id) where is_cover;

create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  created_at timestamptz not null default now()
);

create table public.property_amenities (
  property_id uuid not null references public.properties (id) on delete cascade,
  amenity_id uuid not null references public.amenities (id) on delete cascade,
  primary key (property_id, amenity_id)
);

-- Tarifas especiales por rango de fechas. El rango cubre las NOCHES [start_date, end_date):
-- una noche identificada por su fecha d usa esta tarifa si start_date <= d < end_date.
-- Prioridad: si una noche cae en una tarifa especial usa nightly_price_minor;
-- si no, usa properties.base_price_minor.
create table public.property_rates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  nightly_price_minor bigint not null check (nightly_price_minor > 0),
  minimum_nights int check (minimum_nights is null or minimum_nights > 0),
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date < end_date)
);

create index property_rates_property_idx on public.property_rates (property_id, start_date, end_date);

-- Evita tarifas solapadas para la misma propiedad (mismo rango de noches).
alter table public.property_rates
add constraint property_rates_no_overlap
exclude using gist (property_id with =, daterange(start_date, end_date, '[)') with &&);

create trigger set_updated_at
before update on public.property_rates
for each row
execute function public.set_updated_at();
