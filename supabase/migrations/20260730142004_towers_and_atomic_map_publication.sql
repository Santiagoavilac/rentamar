-- Torres generales y publicación atómica del mapa.
--
-- La imagen editable permanece en image_* / version. El visor público usa
-- published_image_* / published_version junto con published_data, de modo que
-- reemplazar el borrador no modifica el mapa visible hasta la publicación.

create table public.towers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint towers_name_length check (char_length(trim(name)) between 2 and 160),
  constraint towers_sort_order_nonnegative check (sort_order >= 0)
);

create unique index towers_name_unique_idx on public.towers (lower(name));
create index towers_active_order_idx on public.towers (is_active, sort_order, name);

create trigger set_updated_at
before update on public.towers
for each row
execute function public.set_updated_at();

alter table public.properties
  add column tower_id uuid references public.towers (id) on delete set null;

create index properties_tower_idx on public.properties (tower_id);

alter table public.map_items
  add column linked_tower_id uuid references public.towers (id) on delete set null;

create index map_items_linked_tower_idx on public.map_items (linked_tower_id);

-- El marcador genérico anterior deja de formar parte del borrador editable. El
-- snapshot público existente no se toca en esta migración.
update public.map_items
set status = 'archived', is_visible = false
where type = 'tower' and linked_tower_id is null;

alter table public.map_items
  add constraint map_items_tower_link_contract check (
    status = 'archived'
    or (
      (type = 'tower' and linked_tower_id is not null and linked_property_id is null)
      or (type <> 'tower' and linked_tower_id is null)
    )
  );

-- Un marcador oculto sigue siendo una ubicación editable. Solo quitarlo o
-- archivarlo libera la torre para volver a colocarla en el mismo mapa.
create unique index map_items_one_tower_marker_per_map_idx
  on public.map_items (map_id, linked_tower_id)
  where linked_tower_id is not null and status <> 'archived';

alter table public.maps
  add column published_image_url text,
  add column published_image_width integer,
  add column published_image_height integer,
  add column published_version integer;

update public.maps
set
  published_image_url = image_url,
  published_image_width = image_width,
  published_image_height = image_height,
  published_version = version
where status = 'published';

alter table public.maps
  add constraint maps_published_image_width_positive check (
    published_image_width is null or published_image_width > 0
  ),
  add constraint maps_published_image_height_positive check (
    published_image_height is null or published_image_height > 0
  ),
  add constraint maps_published_version_positive check (
    published_version is null or published_version > 0
  );

insert into public.towers (name, sort_order)
values
  ('Torre 1', 1),
  ('Torre 2', 2),
  ('Torre 3', 3),
  ('Torre 4', 4),
  ('Torre 5', 5),
  ('Torre 6', 6)
on conflict do nothing;

update public.properties as property
set tower_id = tower.id
from public.towers as tower
where property.slug = '4-dorm-summer-house-b-15'
  and lower(tower.name) = lower('Torre 4')
  and property.tower_id is null;

alter table public.towers enable row level security;

grant select on table public.towers to anon, authenticated;
grant all on table public.towers to service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.towers from anon, authenticated;

create policy towers_public_read_active
on public.towers
for select
to anon, authenticated
using (is_active);

create policy towers_staff_read_all
on public.towers
for select
to authenticated
using (public.is_staff());

comment on table public.towers is
  'Torres generales del complejo, independientes de su ubicación en el mapa.';
comment on column public.properties.tower_id is
  'Torre opcional a la que pertenece la propiedad.';
comment on column public.map_items.linked_tower_id is
  'Torre general representada por un marcador de tipo tower.';
comment on column public.maps.published_image_url is
  'Imagen pública congelada al publicar el mapa; image_url continúa siendo borrador.';
