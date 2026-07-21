-- Fase 1 — Datos de ejemplo (idempotente).
-- Dinero en unidad menor: Bs 520,00 => 52000.

-- Propiedades
insert into public.properties (
  id, name, slug, short_description, description, property_type, status, zone,
  max_guests, bedrooms, beds, bathrooms, base_price_minor, currency,
  minimum_nights, featured
) values
  ('a1111111-1111-4111-8111-111111111111', 'Departamento Laguna', 'departamento-laguna',
   'Frente a la laguna, ideal para escapadas tranquilas.',
   'Departamento luminoso con vista directa a la laguna de Mar Adentro, a pasos de la playa.',
   'departamento', 'published', 'Frente a la laguna', 4, 2, 3, 1, 52000, 'BOB', 2, true),
  ('a2222222-2222-4222-8222-222222222222', 'Casa Horizonte', 'casa-horizonte',
   'Casa amplia para familias, en el sector arboledas.',
   'Casa de dos plantas con espacios abiertos y jardín, perfecta para grupos y familias.',
   'casa', 'published', 'Sector arboledas', 8, 4, 5, 3, 118000, 'BOB', 2, true),
  ('a3333333-3333-4333-8333-333333333333', 'Suite Marina', 'suite-marina',
   'Suite acogedora en torre central.',
   'Suite para dos con luz cálida y balcón, en el corazón de Mar Adentro.',
   'suite', 'published', 'Torre central', 2, 1, 1, 1, 39000, 'BOB', 1, true),
  ('a4444444-4444-4444-8444-444444444444', 'Villa Palmeras', 'villa-palmeras',
   'Villa con piscina privada al borde de la playa.',
   'Villa exclusiva con piscina privada y palmeras, atardeceres frente al agua.',
   'villa', 'published', 'Borde de piscina', 6, 3, 4, 3, 145000, 'BOB', 3, true)
on conflict (id) do nothing;

-- Imágenes (una cover por propiedad). URLs ya usadas por el frontend.
insert into public.property_images (property_id, url, alt_text, sort_order, is_cover) values
  ('a1111111-1111-4111-8111-111111111111', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=70', 'Interior luminoso de un departamento', 0, true),
  ('a2222222-2222-4222-8222-222222222222', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=70', 'Casa amplia con espacios abiertos', 0, true),
  ('a3333333-3333-4333-8333-333333333333', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=70', 'Suite acogedora con cama amplia y luz cálida', 0, true),
  ('a4444444-4444-4444-8444-444444444444', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=70', 'Villa con piscina privada y palmeras al atardecer', 0, true)
on conflict do nothing;

-- Amenities
insert into public.amenities (id, name, slug, icon) values
  ('b0000001-0000-4000-8000-000000000001', 'Piscina', 'piscina', 'waves'),
  ('b0000002-0000-4000-8000-000000000002', 'Vista a la laguna', 'vista-laguna', 'eye'),
  ('b0000003-0000-4000-8000-000000000003', 'WiFi', 'wifi', 'wifi'),
  ('b0000004-0000-4000-8000-000000000004', 'Estacionamiento', 'estacionamiento', 'car'),
  ('b0000005-0000-4000-8000-000000000005', 'Aire acondicionado', 'aire-acondicionado', 'snowflake'),
  ('b0000006-0000-4000-8000-000000000006', 'Cocina equipada', 'cocina-equipada', 'utensils'),
  ('b0000007-0000-4000-8000-000000000007', 'Seguridad', 'seguridad', 'shield'),
  ('b0000008-0000-4000-8000-000000000008', 'Áreas verdes', 'areas-verdes', 'trees')
on conflict (id) do nothing;

-- Relación propiedad-amenity
insert into public.property_amenities (property_id, amenity_id) values
  ('a1111111-1111-4111-8111-111111111111', 'b0000002-0000-4000-8000-000000000002'),
  ('a1111111-1111-4111-8111-111111111111', 'b0000003-0000-4000-8000-000000000003'),
  ('a1111111-1111-4111-8111-111111111111', 'b0000005-0000-4000-8000-000000000005'),
  ('a2222222-2222-4222-8222-222222222222', 'b0000003-0000-4000-8000-000000000003'),
  ('a2222222-2222-4222-8222-222222222222', 'b0000004-0000-4000-8000-000000000004'),
  ('a2222222-2222-4222-8222-222222222222', 'b0000006-0000-4000-8000-000000000006'),
  ('a2222222-2222-4222-8222-222222222222', 'b0000008-0000-4000-8000-000000000008'),
  ('a3333333-3333-4333-8333-333333333333', 'b0000002-0000-4000-8000-000000000002'),
  ('a3333333-3333-4333-8333-333333333333', 'b0000003-0000-4000-8000-000000000003'),
  ('a3333333-3333-4333-8333-333333333333', 'b0000007-0000-4000-8000-000000000007'),
  ('a4444444-4444-4444-8444-444444444444', 'b0000001-0000-4000-8000-000000000001'),
  ('a4444444-4444-4444-8444-444444444444', 'b0000003-0000-4000-8000-000000000003'),
  ('a4444444-4444-4444-8444-444444444444', 'b0000005-0000-4000-8000-000000000005'),
  ('a4444444-4444-4444-8444-444444444444', 'b0000008-0000-4000-8000-000000000008')
on conflict do nothing;

-- Tarifa especial de ejemplo (temporada alta) para Villa Palmeras.
insert into public.property_rates (property_id, start_date, end_date, nightly_price_minor, label)
select 'a4444444-4444-4444-8444-444444444444', date '2026-12-20', date '2027-01-05', 190000, 'Temporada alta'
where not exists (
  select 1 from public.property_rates
  where property_id = 'a4444444-4444-4444-8444-444444444444' and label = 'Temporada alta'
);
