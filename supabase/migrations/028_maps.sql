-- Mapa interactivo de Mar Adentro — modelo de datos.
--
-- Un mapa (maps) tiene una imagen base en Storage y una colección de marcadores
-- (map_items) colocados con coordenadas NORMALIZADAS (0..1) respecto a la imagen,
-- para que los mismos datos rendericen igual en Next.js y en la futura app Flutter
-- a cualquier tamaño. La imagen base nunca se modifica: los marcadores viven aparte.
--
-- Flujo borrador -> publicado: el editor trabaja sobre map_items (capa editable).
-- Al publicar, se congela un snapshot en maps.published_data (array listo para el
-- visor). El visor lee SOLO ese snapshot de mapas publicados; los borradores nunca
-- se exponen a usuarios no-staff (map_items no tiene política de lectura pública).

create type public.map_status as enum ('draft', 'published', 'archived');

create type public.map_item_type as enum (
  'house',
  'tower',
  'restaurant',
  'clubhouse',
  'entrance',
  'pool',
  'sports',
  'parking',
  'office',
  'social_area',
  'poi'
);

create type public.map_item_status as enum ('draft', 'published', 'archived');

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  image_url text,
  image_width integer,
  image_height integer,
  version integer not null default 1,
  status public.map_status not null default 'draft',
  published_data jsonb,
  published_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maps_image_width_positive check (image_width is null or image_width > 0),
  constraint maps_image_height_positive check (image_height is null or image_height > 0),
  constraint maps_version_positive check (version > 0)
);

create trigger set_updated_at
before update on public.maps
for each row
execute function public.set_updated_at();

create table public.map_items (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete cascade,
  type public.map_item_type not null,
  icon_key text not null,
  name text not null,
  description text,
  normalized_x double precision not null,
  normalized_y double precision not null,
  normalized_width double precision not null default 0.04,
  normalized_height double precision not null default 0.04,
  rotation double precision not null default 0,
  status public.map_item_status not null default 'draft',
  is_visible boolean not null default true,
  linked_property_id uuid references public.properties (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint map_items_x_unit check (normalized_x >= 0 and normalized_x <= 1),
  constraint map_items_y_unit check (normalized_y >= 0 and normalized_y <= 1),
  constraint map_items_width_unit check (normalized_width > 0 and normalized_width <= 1),
  constraint map_items_height_unit check (normalized_height > 0 and normalized_height <= 1)
);

create trigger set_updated_at
before update on public.map_items
for each row
execute function public.set_updated_at();

create index map_items_map_idx on public.map_items (map_id);
create index map_items_map_status_idx on public.map_items (map_id, status);
create index maps_status_idx on public.maps (status);

-- ---------- RLS ----------
-- Escrituras: solo service-role (server-side), igual que el resto del panel. No hay
-- políticas de insert/update/delete para anon/authenticated.

alter table public.maps enable row level security;
alter table public.map_items enable row level security;

-- maps: cualquiera puede leer los publicados (masterplan = contenido de marketing,
-- sin PII); staff lee todos (incluye borradores/archivados).
create policy maps_public_read_published on public.maps
  for select using (status = 'published');

create policy maps_staff_read_all on public.maps
  for select using (public.is_staff());

-- map_items: SOLO staff lee. Sin política pública -> los borradores nunca son
-- visibles para residentes. El visor usa maps.published_data, no esta tabla.
create policy map_items_staff_read on public.map_items
  for select using (public.is_staff());
