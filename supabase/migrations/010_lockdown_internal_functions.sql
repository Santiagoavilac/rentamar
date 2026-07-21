-- Bloquea la ejecución vía RPC de expire_stale_holds, que no forma parte de la
-- API pública. Se sigue ejecutando solo con service role (endpoint interno
-- /api/dev/expire-holds y, en Fase 2, un cron).
--
-- is_admin() / is_staff() se dejan ejecutables por anon/authenticated a propósito:
-- las políticas RLS los invocan en el contexto del rol que consulta (ver 009).
--
-- Siguen expuestas intencionalmente a anon/authenticated (superficie pública de
-- reservas de invitado): calculate_booking_price, create_booking_with_hold,
-- get_property_availability.

revoke execute on function public.expire_stale_holds() from anon, authenticated;
