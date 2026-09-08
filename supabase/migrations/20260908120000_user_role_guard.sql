-- Rol de los guardias de portería. Va en su propia migración porque Postgres no permite usar
-- un valor de enum en la misma transacción en que se agrega; la tabla de cuentas y las
-- políticas que lo referencian viven en 20260908120100_guard_accounts.sql.

alter type public.user_role add value if not exists 'guard';
