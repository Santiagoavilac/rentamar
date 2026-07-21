-- Fase 1 — Reservas, desglose de precio y bloqueos de calendario.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  property_id uuid not null references public.properties (id),
  guest_id uuid references auth.users (id),
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  check_in date not null,
  check_out date not null,
  guests int not null check (guests > 0),
  nights int not null check (nights > 0),
  currency text not null default 'BOB',
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  cleaning_fee_minor bigint not null default 0 check (cleaning_fee_minor >= 0),
  service_fee_minor bigint not null default 0 check (service_fee_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  status public.booking_status not null default 'pending_payment',
  -- Hash (no texto plano) del access token para reservas de invitado.
  access_token_hash text,
  hold_expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_in < check_out)
);

create index bookings_property_idx on public.bookings (property_id);
create index bookings_guest_idx on public.bookings (guest_id);
create index bookings_status_idx on public.bookings (status);

create trigger set_updated_at
before update on public.bookings
for each row
execute function public.set_updated_at();

-- Desglose congelado en el momento de crear la reserva.
create table public.booking_price_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  type public.price_item_type not null,
  description text,
  quantity int not null default 1 check (quantity > 0),
  unit_amount_minor bigint not null,
  total_amount_minor bigint not null,
  created_at timestamptz not null default now()
);

create index booking_price_items_booking_idx on public.booking_price_items (booking_id);

-- Bloqueo temporal de fechas durante el checkout. Rango semiabierto [check_in, check_out):
-- una reserva que sale el día 10 no bloquea otra que entra el día 10.
create table public.booking_holds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  stay_range daterange not null,
  status public.hold_status not null default 'active',
  expires_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create index booking_holds_booking_idx on public.booking_holds (booking_id);
create index booking_holds_property_idx on public.booking_holds (property_id);
