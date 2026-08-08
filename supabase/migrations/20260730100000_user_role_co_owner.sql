-- Rol de copropietario. Va en su propia migración porque Postgres no permite usar un
-- valor de enum en la misma transacción en que se agrega; las tablas y políticas que lo
-- referencian viven en 20260730100100_co_owners.sql.

alter type public.user_role add value if not exists 'co_owner';
