-- Datos que exige la Declaración Jurada de Responsabilidad y que hoy no se piden en
-- ningún flujo: documento, nacionalidad y ciudad de residencia.
--
-- Todas nullable a propósito: las reservas y estadías ya existentes no los tienen, y las
-- reservas que carga administración a mano tampoco están obligadas a completarlos.
--
-- No se tocan las RPC de creación (create_booking_with_hold, create_affiliate_booking_request,
-- register_co_owner_stay). Cambiarles la firma obliga a drop + create de funciones
-- security definer grandes sobre la base de producción, y un error ahí rompe el alta de
-- reservas entera. El servidor completa estas columnas con un update acotado al id que la
-- propia RPC devuelve, que es igual de seguro y no puede romper el flujo existente.

alter table public.bookings
  add column guest_document_id text,
  add column guest_nationality text,
  add column guest_city text;

alter table public.co_owner_stays
  add column nationality text,
  add column city text;
