-- Fase 1 — Prevención de doble reserva a nivel de base de datos.
--
-- booking_holds es la fuente única de verdad del calendario. Cada booking tiene
-- exactamente un hold. Estados que bloquean disponibilidad:
--   active    -> prerreserva vigente (pending_payment)
--   converted -> reserva confirmada (Fase 2)
-- Estados que NO bloquean: expired, released.
--
-- El exclusion constraint rechaza atómicamente dos rangos solapados de la misma
-- propiedad mientras alguno esté active/converted. Al vivir dentro de la función
-- transaccional create_booking_with_hold, no hay ventana de carrera entre validar
-- y crear: si hay solape, la inserción falla y toda la transacción hace rollback.
alter table public.booking_holds
add constraint booking_holds_no_overlap
exclude using gist (property_id with =, stay_range with &&)
where (status in ('active', 'converted'));
