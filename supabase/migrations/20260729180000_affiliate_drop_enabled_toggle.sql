-- El catalogo de afiliados es el mismo catalogo publico: todas las propiedades
-- publicadas. No hay propiedades "habilitadas para afiliados". El unico estado es
-- el precio de reserva que carga el admin al crear o editar la propiedad.

alter table public.properties
  drop constraint properties_affiliate_price_required,
  drop column affiliate_enabled;

-- Depende de affiliate_enabled via %rowtype, asi que se reemplaza en la misma
-- migracion. Se conserva el nombre del error AFFILIATE_DISABLED: ya esta mapeado
-- en src/lib/errors.ts y cubierto por los tests. Solo cambia lo que lo dispara.
create or replace function public.calculate_affiliate_booking_price(
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
  v_total bigint;
begin
  select * into v_property from public.properties where id = p_property_id;
  if not found then raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_property.status <> 'published' then
    raise exception 'PROPERTY_NOT_PUBLISHED' using errcode = 'P0001';
  end if;
  if v_property.affiliate_nightly_price_minor is null then
    raise exception 'AFFILIATE_DISABLED' using errcode = 'P0001';
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

  v_total := v_property.affiliate_nightly_price_minor * v_nights;

  return jsonb_build_object(
    'currency', v_property.currency,
    'nights', v_nights,
    'originalSubtotalMinor', v_total,
    'subtotalMinor', v_total,
    'cleaningFeeMinor', 0,
    'serviceFeeMinor', 0,
    'discountMinor', 0,
    'discountPercent', 0,
    'pricingMode', 'affiliate_flat',
    'durationPriceMinor', null,
    'totalMinor', v_total,
    'items', jsonb_build_array(jsonb_build_object(
      'type', 'nightly_rate',
      'description', 'Tarifa afiliado - ' || v_nights || ' noche(s)',
      'quantity', v_nights,
      'unitAmountMinor', v_property.affiliate_nightly_price_minor,
      'totalAmountMinor', v_total
    ))
  );
end;
$$;

-- Cambia la firma (cae p_enabled), asi que hay que dropear la version vieja.
drop function public.set_property_affiliate_pricing(uuid, boolean, bigint, text, uuid);

create function public.set_property_affiliate_pricing(
  p_property_id uuid,
  p_nightly_minor bigint,
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
  v_old public.properties%rowtype;
begin
  select * into v_old from public.properties where id = p_property_id for update;
  if not found then
    raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_nightly_minor is not null and p_nightly_minor <= 0 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  update public.properties
  set affiliate_nightly_price_minor = p_nightly_minor
  where id = p_property_id;

  insert into public.price_change_history (
    property_id, change_type, old_value, new_value, changed_by, reason
  )
  values (
    p_property_id, 'affiliate_price',
    jsonb_build_object('nightlyMinor', v_old.affiliate_nightly_price_minor),
    jsonb_build_object('nightlyMinor', p_nightly_minor),
    p_actor_id, nullif(btrim(coalesce(p_reason, '')), '')
  );

  return jsonb_build_object(
    'propertyId', p_property_id,
    'affiliateNightlyPriceMinor', p_nightly_minor
  );
end;
$$;

revoke all on function public.calculate_affiliate_booking_price(uuid, date, date, int)
  from public;
grant execute on function public.calculate_affiliate_booking_price(uuid, date, date, int)
  to anon, authenticated, service_role;

revoke all on function public.set_property_affiliate_pricing(uuid, bigint, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_property_affiliate_pricing(uuid, bigint, text, uuid)
  to service_role;
