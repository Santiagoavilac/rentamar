-- Fase 1 — Hardening tras advisors de seguridad.

-- search_path fijo en funciones utilitarias.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.generate_booking_code() set search_path = public, pg_temp;

-- Las funciones de trigger no deben ser invocables como RPC. Los triggers las
-- ejecutan sin chequear EXECUTE, así que revocar es seguro.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.enforce_profile_role_immutable() from public, anon, authenticated;

-- Nota: is_staff() / is_admin() permanecen ejecutables por anon/authenticated
-- porque las políticas RLS las invocan en el contexto del rol que consulta.
-- calculate_booking_price / create_booking_with_hold / get_property_availability
-- son intencionalmente invocables por anon (camino RPC de reservas de invitado).
