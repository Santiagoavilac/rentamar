-- Fase 1 — Enums de dominio.
create type public.property_status as enum ('draft', 'published', 'paused', 'archived');

create type public.booking_status as enum (
  'draft',
  'pending_payment',
  'confirmed',
  'expired',
  'cancelled',
  'completed',
  'manual_review'
);

create type public.hold_status as enum ('active', 'converted', 'expired', 'released');

create type public.price_item_type as enum ('nightly_rate', 'cleaning_fee', 'service_fee', 'discount');

create type public.user_role as enum ('guest', 'admin', 'operator');
