-- Precios totales por cantidad de noches y contenido adicional de la ficha publica.
-- Migracion aplicada y verificada. No modifica reservas ni precios existentes.

alter table public.properties
  add column duration_pricing_enabled boolean not null default false,
  add column rules text,
  add column location_reference text;

create table public.property_stay_prices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  nights int not null check (nights between 1 and 365),
  total_price_minor bigint not null check (total_price_minor > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, nights)
);

create index property_stay_prices_property_idx
  on public.property_stay_prices (property_id, nights);

create trigger set_updated_at
before update on public.property_stay_prices
for each row execute function public.set_updated_at();

alter table public.property_stay_prices enable row level security;

revoke all on table public.property_stay_prices from public, anon, authenticated;
grant select on table public.property_stay_prices to anon, authenticated;
grant all on table public.property_stay_prices to service_role;

create policy property_stay_prices_public_read
on public.property_stay_prices for select
to anon
using (
  exists (
    select 1 from public.properties p
    where p.id = property_stay_prices.property_id
      and p.status = 'published'
      and p.duration_pricing_enabled
  )
);

create policy property_stay_prices_authenticated_read
on public.property_stay_prices for select
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.properties p
    where p.id = property_stay_prices.property_id
      and p.status = 'published'
      and p.duration_pricing_enabled
  )
);

alter type public.price_change_type
  add value if not exists 'duration_pricing_update';

-- Guarda precio base, activacion y tabla completa de duraciones en una transaccion.
-- El JSON acepta exclusivamente objetos { nights, totalMinor }.
create or replace function public.save_property_pricing(
  p_property_id uuid,
  p_base_price_minor bigint,
  p_duration_pricing_enabled boolean,
  p_prices jsonb,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_property public.properties%rowtype;
  v_old_prices jsonb;
  v_new_prices jsonb;
begin
  if p_base_price_minor < 0
    or jsonb_typeof(p_prices) <> 'array'
    or length(btrim(coalesce(p_reason, ''))) < 4 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  select * into v_property
  from public.properties
  where id = p_property_id
  for update;
  if not found then
    raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1
  from jsonb_array_elements(p_prices) as item
  where jsonb_typeof(item) <> 'object'
    or (item - 'nights' - 'totalMinor') <> '{}'::jsonb;
  if found then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  perform 1
  from jsonb_to_recordset(p_prices) as x(nights int, "totalMinor" bigint)
  where x.nights is null
    or x."totalMinor" is null
    or x.nights not between 1 and 365
    or x."totalMinor" <= 0
    or x."totalMinor" > p_base_price_minor * x.nights;
  if found then
    raise exception 'INVALID_STAY_PRICE' using errcode = 'P0001';
  end if;

  if (
    select count(*) <> count(distinct x.nights)
    from jsonb_to_recordset(p_prices) as x(nights int, "totalMinor" bigint)
  ) then
    raise exception 'DUPLICATE_STAY_NIGHTS' using errcode = '23505';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('nights', nights, 'totalMinor', total_price_minor)
      order by nights
    ),
    '[]'::jsonb
  ) into v_old_prices
  from public.property_stay_prices
  where property_id = p_property_id;

  update public.properties
  set base_price_minor = p_base_price_minor,
      duration_pricing_enabled = p_duration_pricing_enabled
  where id = p_property_id;

  delete from public.property_stay_prices where property_id = p_property_id;

  insert into public.property_stay_prices (property_id, nights, total_price_minor)
  select p_property_id, x.nights, x."totalMinor"
  from jsonb_to_recordset(p_prices) as x(nights int, "totalMinor" bigint);

  select coalesce(
    jsonb_agg(
      jsonb_build_object('nights', nights, 'totalMinor', total_price_minor)
      order by nights
    ),
    '[]'::jsonb
  ) into v_new_prices
  from public.property_stay_prices
  where property_id = p_property_id;

  if v_property.base_price_minor <> p_base_price_minor then
    insert into public.price_change_history (
      property_id, change_type, old_value, new_value, changed_by, reason
    ) values (
      p_property_id, 'base_price',
      jsonb_build_object('basePriceMinor', v_property.base_price_minor),
      jsonb_build_object('basePriceMinor', p_base_price_minor),
      p_actor_id, btrim(p_reason)
    );
  end if;

  if v_property.duration_pricing_enabled is distinct from p_duration_pricing_enabled
    or v_old_prices is distinct from v_new_prices then
    insert into public.price_change_history (
      property_id, change_type, old_value, new_value, changed_by, reason
    ) values (
      p_property_id, 'duration_pricing_update',
      jsonb_build_object(
        'enabled', v_property.duration_pricing_enabled,
        'prices', v_old_prices
      ),
      jsonb_build_object(
        'enabled', p_duration_pricing_enabled,
        'prices', v_new_prices
      ),
      p_actor_id, btrim(p_reason)
    );
  end if;

  return jsonb_build_object(
    'propertyId', p_property_id,
    'basePriceMinor', p_base_price_minor,
    'durationPricingEnabled', p_duration_pricing_enabled,
    'prices', v_new_prices
  );
end;
$$;

revoke all on function public.save_property_pricing(
  uuid, bigint, boolean, jsonb, uuid, text
) from public, anon, authenticated;
grant execute on function public.save_property_pricing(
  uuid, bigint, boolean, jsonb, uuid, text
) to service_role;

-- Impide que el editor general deje precios por duracion por encima del nuevo base.
create or replace function public.change_property_base_price(
  p_property_id uuid,
  p_new_minor bigint,
  p_reason text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_old bigint;
begin
  if p_new_minor < 0 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  select base_price_minor into v_old
  from public.properties where id = p_property_id for update;
  if not found then
    raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1 from public.property_stay_prices
  where property_id = p_property_id
    and total_price_minor > p_new_minor * nights
  limit 1;
  if found then
    raise exception 'STAY_PRICE_ABOVE_BASE' using errcode = 'P0001';
  end if;

  update public.properties set base_price_minor = p_new_minor where id = p_property_id;
  insert into public.price_change_history (
    property_id, change_type, old_value, new_value, changed_by, reason
  ) values (
    p_property_id, 'base_price',
    jsonb_build_object('basePriceMinor', v_old),
    jsonb_build_object('basePriceMinor', p_new_minor),
    p_actor_id, p_reason
  );
  return jsonb_build_object('propertyId', p_property_id, 'basePriceMinor', p_new_minor);
end;
$$;

-- Fuente unica de verdad del precio. Las tarifas estacionales tienen prioridad.
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
  v_original_subtotal bigint := 0;
  v_duration_total bigint;
  v_discount bigint := 0;
  v_total bigint;
  v_has_seasonal boolean := false;
  v_pricing_mode text := 'nightly';
  v_items jsonb := '[]'::jsonb;
  v_discount_percent numeric := 0;
begin
  select * into v_property from public.properties where id = p_property_id;
  if not found then raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_property.status <> 'published' then
    raise exception 'PROPERTY_NOT_PUBLISHED' using errcode = 'P0001';
  end if;
  if p_check_in >= p_check_out or p_check_in < current_date then
    raise exception 'INVALID_DATES' using errcode = '22007';
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
  ), priced as (
    select n.night,
      coalesce(r.nightly_price_minor, v_property.base_price_minor) as price,
      r.id is not null as seasonal
    from nights n
    left join lateral (
      select id, nightly_price_minor
      from public.property_rates r
      where r.property_id = p_property_id
        and n.night >= r.start_date and n.night < r.end_date
      order by r.start_date desc limit 1
    ) r on true
  ), grouped as (
    select price, seasonal, count(*)::int as qty
    from priced group by price, seasonal
  )
  select coalesce(sum(price * qty), 0), coalesce(bool_or(seasonal), false),
    coalesce(jsonb_agg(jsonb_build_object(
      'type', 'nightly_rate',
      'description', case when seasonal then 'Tarifa estacional' else qty || ' noche(s)' end,
      'quantity', qty,
      'unitAmountMinor', price,
      'totalAmountMinor', price * qty
    ) order by seasonal, price), '[]'::jsonb)
  into v_original_subtotal, v_has_seasonal, v_items
  from grouped;

  if v_property.duration_pricing_enabled and not v_has_seasonal then
    select total_price_minor into v_duration_total
    from public.property_stay_prices
    where property_id = p_property_id and nights = v_nights;
    if found and v_duration_total <= v_original_subtotal then
      v_pricing_mode := 'duration';
      v_discount := v_original_subtotal - v_duration_total;
    end if;
  end if;

  if v_discount > 0 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'type', 'discount',
      'description', 'Descuento por ' || v_nights || ' noche(s)',
      'quantity', 1,
      'unitAmountMinor', -v_discount,
      'totalAmountMinor', -v_discount
    ));
    v_discount_percent := round((v_discount::numeric * 100) / v_original_subtotal, 2);
  end if;

  v_total := v_original_subtotal - v_discount;
  return jsonb_build_object(
    'currency', v_property.currency,
    'nights', v_nights,
    'originalSubtotalMinor', v_original_subtotal,
    'subtotalMinor', v_original_subtotal,
    'cleaningFeeMinor', 0,
    'serviceFeeMinor', 0,
    'discountMinor', v_discount,
    'discountPercent', v_discount_percent,
    'pricingMode', v_pricing_mode,
    'durationPriceMinor', case when v_pricing_mode = 'duration' then v_duration_total else null end,
    'totalMinor', v_total,
    'items', v_items
  );
end;
$$;

-- Disponibilidad publica unificada: reservas y bloqueos administrativos activos.
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
    and (h.status = 'converted' or (h.status = 'active' and h.expires_at > now()))
    and h.stay_range && daterange(p_from, p_to, '[)')
  union all
  select b.stay_range
  from public.availability_blocks b
  where b.property_id = p_property_id
    and b.status = 'active'
    and b.stay_range && daterange(p_from, p_to, '[)');
$$;

-- Creacion publica con todos los importes congelados. El cliente nunca envia dinero.
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
  v_expires timestamptz := now() + make_interval(mins => p_hold_minutes);
  v_item jsonb;
begin
  v_price := public.calculate_booking_price(p_property_id, p_check_in, p_check_out, p_guest_count);
  v_code := public.generate_booking_code();

  perform pg_advisory_xact_lock(hashtext(p_property_id::text));
  perform 1 from public.availability_blocks b
  where b.property_id = p_property_id and b.status = 'active'
    and b.stay_range && daterange(p_check_in, p_check_out, '[)') limit 1;
  if found then raise exception 'AVAILABILITY_BLOCKED' using errcode = 'P0001'; end if;

  insert into public.bookings (
    booking_code, property_id, guest_name, guest_email, guest_phone,
    check_in, check_out, guests, nights, currency,
    subtotal_minor, cleaning_fee_minor, service_fee_minor, discount_minor,
    total_minor, status, payment_status, access_token_hash, hold_expires_at
  ) values (
    v_code, p_property_id, btrim(p_guest_name), lower(btrim(p_guest_email)),
    nullif(btrim(coalesce(p_guest_phone, '')), ''),
    p_check_in, p_check_out, p_guest_count, (v_price ->> 'nights')::int,
    v_price ->> 'currency', (v_price ->> 'subtotalMinor')::bigint,
    coalesce((v_price ->> 'cleaningFeeMinor')::bigint, 0),
    coalesce((v_price ->> 'serviceFeeMinor')::bigint, 0),
    coalesce((v_price ->> 'discountMinor')::bigint, 0),
    (v_price ->> 'totalMinor')::bigint, 'pending_payment', 'unpaid',
    p_access_token_hash, v_expires
  ) returning id into v_booking_id;

  for v_item in select * from jsonb_array_elements(v_price -> 'items') loop
    insert into public.booking_price_items (
      booking_id, type, description, quantity, unit_amount_minor, total_amount_minor
    ) values (
      v_booking_id, (v_item ->> 'type')::public.price_item_type,
      v_item ->> 'description', (v_item ->> 'quantity')::int,
      (v_item ->> 'unitAmountMinor')::bigint,
      (v_item ->> 'totalAmountMinor')::bigint
    );
  end loop;

  insert into public.booking_holds (booking_id, property_id, stay_range, status, expires_at)
  values (v_booking_id, p_property_id, daterange(p_check_in, p_check_out, '[)'), 'active', v_expires);

  return jsonb_build_object(
    'bookingId', v_booking_id, 'bookingCode', v_code,
    'status', 'pending_payment', 'currency', v_price ->> 'currency',
    'totalMinor', (v_price ->> 'totalMinor')::bigint, 'holdExpiresAt', v_expires
  );
exception when exclusion_violation then
  raise exception 'BOOKING_CONFLICT' using errcode = '23P01';
end;
$$;

revoke all on function public.create_booking_with_hold(
  uuid, date, date, int, text, text, text, text, int
) from public;
grant execute on function public.create_booking_with_hold(
  uuid, date, date, int, text, text, text, text, int
) to anon, authenticated, service_role;

revoke all on function public.calculate_booking_price(uuid, date, date, int) from public;
grant execute on function public.calculate_booking_price(uuid, date, date, int)
  to anon, authenticated, service_role;

revoke all on function public.get_property_availability(uuid, date, date) from public;
grant execute on function public.get_property_availability(uuid, date, date)
  to anon, authenticated, service_role;
