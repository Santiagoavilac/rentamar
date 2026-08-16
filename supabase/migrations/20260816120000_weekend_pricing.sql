-- Recargo global de fin de semana. Un solo ajuste para todas las propiedades:
--   days: días de la semana con recargo, en ISO (1 = lunes … 7 = domingo).
--   surchargePercent: % que se suma al precio base de esa noche (0 = desactivado).
-- Los feriados NO tienen mecanismo propio: se cargan como tarifa estacional del día
-- en la propiedad (property_rates), que ya tiene prioridad sobre todo lo demás.
insert into public.app_settings (key, value)
values ('weekend_pricing', '{"days": [5, 6], "surchargePercent": 0}'::jsonb)
on conflict (key) do nothing;

-- calculate_booking_price + recargo de fin de semana.
-- Prioridad por noche: tarifa estacional (incluye feriados) > recargo de fin de
-- semana sobre el precio base > precio base. El paquete por duración sigue después
-- y solo se aplica si su total es menor o igual al subtotal ya recargado.
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
  v_weekend jsonb;
  v_weekend_days int[] := '{}';
  v_weekend_percent numeric := 0;
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

  select value into v_weekend from public.app_settings where key = 'weekend_pricing';
  v_weekend_percent := greatest(coalesce((v_weekend ->> 'surchargePercent')::numeric, 0), 0);
  select coalesce(array_agg(d::int), '{}')
  into v_weekend_days
  from jsonb_array_elements_text(coalesce(v_weekend -> 'days', '[]'::jsonb)) as t(d);

  with nights as (
    select gs::date as night
    from generate_series(p_check_in, p_check_out - 1, interval '1 day') gs
  ), priced as (
    select n.night,
      r.id is not null as seasonal,
      r.id is null
        and v_weekend_percent > 0
        and extract(isodow from n.night)::int = any(v_weekend_days) as weekend,
      case
        when r.id is not null then r.nightly_price_minor
        when v_weekend_percent > 0 and extract(isodow from n.night)::int = any(v_weekend_days)
          then round(v_property.base_price_minor * (1 + v_weekend_percent / 100))::bigint
        else v_property.base_price_minor
      end as price
    from nights n
    left join lateral (
      select id, nightly_price_minor
      from public.property_rates r
      where r.property_id = p_property_id
        and n.night >= r.start_date and n.night < r.end_date
      order by r.start_date desc limit 1
    ) r on true
  ), grouped as (
    select price, seasonal, weekend, count(*)::int as qty
    from priced group by price, seasonal, weekend
  )
  select coalesce(sum(price * qty), 0), coalesce(bool_or(seasonal), false),
    coalesce(jsonb_agg(jsonb_build_object(
      'type', 'nightly_rate',
      'description', case
        when seasonal then 'Tarifa estacional'
        when weekend then qty || ' noche(s) de fin de semana'
        else qty || ' noche(s)'
      end,
      'quantity', qty,
      'unitAmountMinor', price,
      'totalAmountMinor', price * qty
    ) order by seasonal, weekend, price), '[]'::jsonb)
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

revoke all on function public.calculate_booking_price(uuid, date, date, int) from public;
grant execute on function public.calculate_booking_price(uuid, date, date, int)
  to anon, authenticated, service_role;
