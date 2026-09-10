-- Clase del inmueble y catálogo de comodidades cargable desde el panel.
--
-- La portada mostraba todos los departamentos mezclados, sin diferenciar calidad. Y las
-- comodidades ya existían en la base (`amenities` + `property_amenities`) y ya se
-- renderizaban en la ficha pública, pero no había forma de asignarlas: el detalle de la
-- propiedad solo mostraba un contador "N de M".

-- ---------- Clase ----------
-- Enum y no texto libre: `property_type` ya es texto libre y una errata ahí crea un "tipo"
-- nuevo en el filtro de la portada. Con las clases eso sería peor, porque ordenan.
--
-- Nullable a propósito: las propiedades ya cargadas se quedan sin clase hasta que alguien
-- decida cuál les toca. Inventarles una por default sería mentir en la portada.

create type public.property_class as enum ('lujo', 'a', 'b', 'c');

alter table public.properties add column property_class public.property_class;

-- La portada agrupa y ordena por clase, y dentro de cada clase por precio.
create index properties_class_idx on public.properties (property_class, base_price_minor);

-- ---------- Cantidad por comodidad ----------
-- "Cuántas teles" no se puede responder con un booleano. Null = la comodidad está pero no
-- se cuenta (wifi, parrilla): la ficha muestra solo el nombre.

alter table public.property_amenities add column quantity int check (quantity > 0);

-- ---------- Catálogo ----------
-- Las ocho de la semilla original eran de ejemplo. Estas son las que la administración
-- necesita marcar de verdad, al estilo de Airbnb. Por slug y con on conflict, así correr
-- esto de nuevo no duplica nada ni pisa lo que ya esté asignado.

insert into public.amenities (name, slug, icon) values
  ('WiFi', 'wifi', 'wifi'),
  ('Aire acondicionado', 'aire-acondicionado', 'snowflake'),
  ('Televisor', 'televisor', 'tv'),
  ('Cocina equipada', 'cocina-equipada', 'utensils'),
  ('Vajilla completa', 'vajilla', 'utensils-crossed'),
  ('Heladera', 'heladera', 'refrigerator'),
  ('Microondas', 'microondas', 'microwave'),
  ('Lavarropas', 'lavarropas', 'washing-machine'),
  ('Parrilla', 'parrilla', 'flame'),
  ('Extintor', 'extintor', 'fire-extinguisher'),
  ('Botiquín de primeros auxilios', 'botiquin', 'briefcase-medical'),
  ('Detector de humo', 'detector-humo', 'siren'),
  ('Chalecos salvavidas', 'chalecos-salvavidas', 'life-buoy'),
  ('Ropa de cama', 'ropa-de-cama', 'bed-double'),
  ('Toallas', 'toallas', 'shirt'),
  ('Agua caliente', 'agua-caliente', 'droplets'),
  ('Estacionamiento', 'estacionamiento', 'car'),
  ('Piscina', 'piscina', 'waves'),
  ('Vista a la laguna', 'vista-laguna', 'eye'),
  ('Áreas verdes', 'areas-verdes', 'trees'),
  ('Seguridad 24 horas', 'seguridad', 'shield'),
  ('Ventilador', 'ventilador', 'fan'),
  ('Plancha', 'plancha', 'shirt'),
  ('Secador de pelo', 'secador-pelo', 'wind')
on conflict (slug) do update set name = excluded.name, icon = excluded.icon;
