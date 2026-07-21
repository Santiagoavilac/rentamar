-- Fase 2 — Estado de pago a nivel de reserva. No duplica booking.status:
-- booking.status es el ciclo de vida de la reserva; payment_status resume el cobro.
alter table public.bookings
add column payment_status public.booking_payment_status not null default 'unpaid';
