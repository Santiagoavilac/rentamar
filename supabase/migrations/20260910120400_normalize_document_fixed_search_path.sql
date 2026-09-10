-- `normalize_document` había quedado sin search_path fijo y el linter lo marca.
--
-- Se omitió porque la usa una columna generada, que exige una expresión inmutable. Pero una
-- cláusula SET no cambia la volatilidad declarada: sigue siendo immutable y la columna
-- generada la sigue aceptando (verificado: indisvalid y la generación siguen vivas).
--
-- `coalesce` y `nullif` no se califican: son construcciones del lenguaje SQL, no funciones
-- de un esquema. Las que sí lo son van con pg_catalog explícito.

create or replace function public.normalize_document(p_document text)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select nullif(
    pg_catalog.upper(
      pg_catalog.regexp_replace(coalesce(p_document, ''), '[^A-Za-z0-9]', '', 'g')
    ),
    ''
  );
$$;
