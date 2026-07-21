-- Fase 2 — Enums del sistema de pagos.

create type public.payment_status as enum (
  'created',
  'pending',
  'paid',
  'expired',
  'error',
  'cancelled',
  'refunded',
  'manual_review'
);

create type public.payment_provider as enum ('mock', 'bnb');

create type public.payment_method as enum ('qr');

create type public.payment_event_source as enum (
  'create',
  'browser_poll',
  'manual_verify',
  'cron',
  'admin',
  'reconciliation'
);

-- Estado de pago derivado a nivel de reserva (no duplica booking.status).
create type public.booking_payment_status as enum (
  'unpaid',
  'pending',
  'paid',
  'expired',
  'failed',
  'refunded'
);
