-- Rol del personal de limpieza. Va en su propia migración porque Postgres no permite usar
-- un valor de enum en la misma transacción en que se agrega; las tablas y políticas que lo
-- referencian viven en 20260803100100_cleaning_reports.sql.

alter type public.user_role add value if not exists 'cleaner';
