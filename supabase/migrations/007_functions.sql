-- Fase 1 — Funciones de negocio server-side.

-- Código de reserva legible y único: RM-YYYY-NNNNNN.
create sequence if not exists public.booking_code_seq;

create or replace function public.generate_booking_code()
returns text
language sql
volatile
as $$
  select 'RM-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.booking_code_seq')::text, 6, '0');
$$;

-- Cálculo de precio server-side. Nunca confía en montos del cliente.
-- Devuelve jsonb con currency, nights, subtotalMinor, totalMinor e items (desglose).
create or replace function public.calculate_booking_price(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_property public.properties%rowtype;
  v_nights int;
  v_subtotal bigint := 0;
  v_items jsonb;
begin
  select * into v_property from public.properties where id = p_property_id;
  if not found then
    raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_property.status <> 'published' then
    raise exception 'PROPERTY_NOT_PUBLISHED' using errcode = 'P0001';
  end if;
  if p_check_in >= p_check_out then
    raise exception 'INVALID_DATES' using errcode = '22007';
  end if;
  if p_check_in < current_date then
    raise exception 'INVALID_DATES_PAST' using errcode = '22007';
  end if;
  if p_guest_count < 1 or p_guest_count > v_property.max_guests then
    raise exception 'GUEST_CAPACITY' using errcode = 'P0001';
  end if;

  v_nights := p_check_out - p_check_in;
  if v_nights < v_property.minimum_nights then
    raise exception 'MINIMUM_NIGHTS' using errcode = 'P0001';
  end if;

  with nights as (
    select gs::date as night
    from generate_series(p_check_in, p_check_out - 1, interval '1 day') gs
  ),
  priced as (
    select
      n.night,
      coalesce(
        (
          select r.nightly_price_minor
          from public.property_rates r
          where r.property_id = p_property_id
            and n.night >= r.start_date
            and n.night < r.end_date
          order by r.start_date desc
          limit 1
        ),
        v_property.base_price_minor
      ) as price
    from nights n
  ),
  grouped as (
    select price, count(*)::int as qty
    from priced
    group by price
  )
  select
    coalesce(sum(price * qty), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'nightly_rate',
          'description', qty || ' noche(s)',
          'quantity', qty,
          'unitAmountMinor', price,
          'totalAmountMinor', price * qty
        )
        order by price
      ),
      '[]'::jsonb
    )
  into v_subtotal, v_items
  from grouped;

  return jsonb_build_object(
    'currency', v_property.currency,
    'nights', v_nights,
    'subtotalMinor', v_subtotal,
    'cleaningFeeMinor', 0,
    'serviceFeeMinor', 0,
    'discountMinor', 0,
    'totalMinor', v_subtotal,
    'items', v_items
  );
end;
$$;

-- Creación atómica de reserva + desglose + hold. El total se calcula acá dentro;
-- el cliente nunca envía montos. El exclusion constraint garantiza que no haya
-- solapes: si falla, toda la transacción hace rollback.
create or replace function public.create_booking_with_hold(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count int,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_access_token_hash text,
  p_hold_minutes int default 30
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_price jsonb;
  v_booking_id uuid;
  v_code text;
  v_nights int;
  v_expires timestamptz := now() + make_interval(mins => p_hold_minutes);
  v_item jsonb;
begin
  v_price := public.calculate_booking_price(p_property_id, p_check_in, p_check_out, p_guest_count);
  v_nights := (v_price ->> 'nights')::int;
  v_code := public.generate_booking_code();

  insert into public.bookings (
    booking_code, property_id, guest_name, guest_email, guest_phone,
    check_in, check_out, guests, nights, currency,
    subtotal_minor, total_minor, status, access_token_hash, hold_expires_at
  )
  values (
    v_code, p_property_id, p_guest_name, p_guest_email, p_guest_phone,
    p_check_in, p_check_out, p_guest_count, v_nights, v_price ->> 'currency',
    (v_price ->> 'subtotalMinor')::bigint, (v_price ->> 'totalMinor')::bigint,
    'pending_payment', p_access_token_hash, v_expires
  )
  returning id into v_booking_id;

  for v_item in select * from jsonb_array_elements(v_price -> 'items')
  loop
    insert into public.booking_price_items (
      booking_id, type, description, quantity, unit_amount_minor, total_amount_minor
    )
    values (
      v_booking_id,
      (v_item ->> 'type')::public.price_item_type,
      v_item ->> 'description',
      (v_item ->> 'quantity')::int,
      (v_item ->> 'unitAmountMinor')::bigint,
      (v_item ->> 'totalAmountMinor')::bigint
    );
  end loop;

  insert into public.booking_holds (booking_id, property_id, stay_range, status, expires_at)
  values (v_booking_id, p_property_id, daterange(p_check_in, p_check_out, '[)'), 'active', v_expires);

  return jsonb_build_object(
    'bookingId', v_booking_id,
    'bookingCode', v_code,
    'status', 'pending_payment',
    'currency', v_price ->> 'currency',
    'totalMinor', (v_price ->> 'totalMinor')::bigint,
    'holdExpiresAt', v_expires
  );
exception
  when exclusion_violation then
    raise exception 'BOOKING_CONFLICT' using errcode = '23P01';
end;
$$;

-- Disponibilidad: devuelve los rangos ocupados dentro de [p_from, p_to).
-- Considera holds active no vencidos y bookings confirmadas (converted).
-- Ignora holds active vencidos (aún no barridos), expired y released.
create or replace function public.get_property_availability(
  p_property_id uuid,
  p_from date,
  p_to date
)
returns table (stay_range daterange)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select h.stay_range
  from public.booking_holds h
  where h.property_id = p_property_id
    and (
      h.status = 'converted'
      or (h.status = 'active' and h.expires_at > now())
    )
    and h.stay_range && daterange(p_from, p_to, '[)');
$$;

-- Barrido de holds vencidos. En Fase 1 se invoca desde un endpoint interno; en
-- Fase 2 puede engancharse a pg_cron. Marca el hold expired y la booking expired.
create or replace function public.expire_stale_holds()
returns int
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  with expired as (
    update public.booking_holds
    set status = 'expired', released_at = now()
    where status = 'active' and expires_at <= now()
    returning booking_id
  )
  update public.bookings b
  set status = 'expired'
  from expired e
  where b.id = e.booking_id and b.status = 'pending_payment';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Permisos explícitos: revocar público y otorgar solo a los roles necesarios.
revoke all on function public.calculate_booking_price(uuid, date, date, int) from public;
grant execute on function public.calculate_booking_price(uuid, date, date, int) to anon, authenticated, service_role;

revoke all on function public.create_booking_with_hold(uuid, date, date, int, text, text, text, text, int) from public;
grant execute on function public.create_booking_with_hold(uuid, date, date, int, text, text, text, text, int) to anon, authenticated, service_role;

revoke all on function public.get_property_availability(uuid, date, date) from public;
grant execute on function public.get_property_availability(uuid, date, date) to anon, authenticated, service_role;

-- El barrido solo desde el servidor (service role).
revoke all on function public.expire_stale_holds() from public;
grant execute on function public.expire_stale_holds() to service_role;
