-- Fase 1 — Extensiones necesarias.
-- pgcrypto: gen_random_uuid() y digest() para hashear el access token.
-- btree_gist: permite combinar igualdad (property_id) con && (daterange) en el
--   exclusion constraint que evita dobles reservas.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
