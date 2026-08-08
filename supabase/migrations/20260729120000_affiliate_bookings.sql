-- Canal de afiliados. Un afiliado reserva desde /afiliados sin iniciar sesion,
-- con tarifa plana por noche, acompanantes y cierre por WhatsApp.
--
-- Las solicitudes viven en public.bookings con la columna discriminadora `channel`
-- en vez de una tabla aparte: asi reutilizan el hold con su restriccion GiST
-- anti-solapamiento, get_property_availability, el planificador y cancel_booking.
-- No se agrega un valor a booking_status por el mismo motivo (obligaria a tocar
-- cancel_booking, update_admin_booking, expire_stale_holds y los tipos generados).

-- ---------- Esquema ----------

create type public.booking_channel as enum ('direct', 'admin', 'affiliate');

alter table public.bookings
  add column channel public.booking_channel not null default 'direct',
  add column affiliate_document_id text,
  alter column guest_email drop not null;

alter table public.bookings
  add constraint bookings_contact_required
    check (guest_email is not null or guest_phone is not null),
  add constraint bookings_affiliate_fields
    check (
      channel <> 'affiliate'
      or (guest_phone is not null and affiliate_document_id is not null)
    );

create index bookings_channel_status_idx on public.bookings (channel, status);

alter table public.properties
  add column affiliate_enabled boolean not null default false,
  add column affiliate_nightly_price_minor bigint
    check (affiliate_nightly_price_minor is null or affiliate_nightly_price_minor > 0);

alter table public.properties
  add constraint properties_affiliate_price_required
    check (not affiliate_enabled or affiliate_nightly_price_minor is not null);

-- Acompanantes declarados por el afiliado al enviar la solicitud.
create table public.booking_companions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) >= 2),
  document_id text not null check (length(btrim(document_id)) >= 4),
  phone text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index booking_companions_booking_idx on public.booking_companions (booking_id, sort_order);

alter table public.booking_companions enable row level security;

-- Solo lectura para staff. Toda escritura pasa por RPC security definer.
create policy booking_companions_staff_read on public.booking_companions
  for select to authenticated using (public.is_staff());

-- ---------- Precio de afiliado ----------

-- Tarifa plana: total = precio_afiliado * noches. Ignora property_rates
-- (estacionales) y property_stay_prices (por duracion) a proposito.
-- Devuelve el MISMO juego de claves que calculate_booking_price para que el
-- bucle que inserta booking_price_items sirva sin cambios. Este es el unico
-- punto a tocar si mas adelante se agregan reglas de precio para afiliados.
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
  if not v_property.affiliate_enabled or v_property.affiliate_nightly_price_minor is null then
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

-- ---------- Solicitud publica de afiliado ----------

-- Crea la solicitud y bloquea las fechas. El hold vence en la hora de salida
-- local de la propiedad: asi el bloqueo dura hasta que un admin lo confirme o
-- cancele, y se libera solo cuando termina la estadia (el barrido
-- expire_stale_holds ya agendado por pg_cron lo recoge, sin cron nuevo).
create or replace function public.create_affiliate_booking_request(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count int,
  p_affiliate_name text,
  p_affiliate_document_id text,
  p_affiliate_phone text,
  p_affiliate_email text,
  p_companions jsonb,
  p_max_pending int default 3
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_property public.properties%rowtype;
  v_price jsonb;
  v_booking_id uuid;
  v_code text;
  v_total bigint;
  v_expires timestamptz;
  v_item jsonb;
  v_name text := btrim(coalesce(p_affiliate_name, ''));
  v_doc text := upper(btrim(coalesce(p_affiliate_document_id, '')));
  v_phone text := btrim(coalesce(p_affiliate_phone, ''));
  v_phone_digits text;
  v_email text := lower(btrim(coalesce(p_affiliate_email, '')));
  v_companions jsonb := coalesce(p_companions, '[]'::jsonb);
  v_pending int;
begin
  v_phone_digits := regexp_replace(v_phone, '\D', '', 'g');

  if length(v_name) < 2 or length(v_doc) < 4 or length(v_phone_digits) < 7 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_companions) <> 'array' or jsonb_array_length(v_companions) > 20 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  if p_check_in is null or p_check_out is null or p_check_in >= p_check_out then
    raise exception 'INVALID_DATES' using errcode = '22007';
  end if;
  if p_guest_count is null or p_guest_count < 1 then
    raise exception 'GUEST_CAPACITY' using errcode = 'P0001';
  end if;

  -- Anti-abuso: el flujo es anonimo y bloquea inventario, asi que se limita la
  -- cantidad de solicitudes sin confirmar por telefono o CI.
  select count(*) into v_pending
  from public.bookings b
  where b.channel = 'affiliate'
    and b.status = 'pending_payment'
    and (
      regexp_replace(coalesce(b.guest_phone, ''), '\D', '', 'g') = v_phone_digits
      or b.affiliate_document_id = v_doc
    );
  if v_pending >= greatest(p_max_pending, 1) then
    raise exception 'AFFILIATE_PENDING_LIMIT' using errcode = 'P0001';
  end if;

  select * into v_property from public.properties where id = p_property_id;
  if not found then raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Valida propiedad publicada, tarifa habilitada, aforo y minimo de noches.
  v_price := public.calculate_affiliate_booking_price(
    p_property_id, p_check_in, p_check_out, p_guest_count
  );
  v_total := (v_price ->> 'totalMinor')::bigint;
  v_code := public.generate_booking_code();
  v_expires := ((p_check_out::timestamp + v_property.check_out_time) at time zone 'America/La_Paz');

  perform pg_advisory_xact_lock(hashtext(p_property_id::text));
  perform 1
  from public.availability_blocks b
  where b.property_id = p_property_id
    and b.status = 'active'
    and b.stay_range && daterange(p_check_in, p_check_out, '[)')
  limit 1;
  if found then
    raise exception 'AVAILABILITY_BLOCKED' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    booking_code, property_id, channel, guest_name, guest_email, guest_phone,
    affiliate_document_id, check_in, check_out, guests, nights, currency,
    subtotal_minor, cleaning_fee_minor, service_fee_minor, discount_minor,
    total_minor, status, payment_status, hold_expires_at
  )
  values (
    v_code, p_property_id, 'affiliate', v_name, nullif(v_email, ''), v_phone,
    v_doc, p_check_in, p_check_out, p_guest_count, (v_price ->> 'nights')::int,
    v_price ->> 'currency', (v_price ->> 'subtotalMinor')::bigint, 0, 0, 0,
    v_total, 'pending_payment', 'unpaid', v_expires
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

  insert into public.booking_companions (booking_id, full_name, document_id, phone, sort_order)
  select
    v_booking_id,
    btrim(c.value ->> 'fullName'),
    upper(btrim(c.value ->> 'documentId')),
    nullif(btrim(coalesce(c.value ->> 'phone', '')), ''),
    (c.ordinality - 1)::int
  from jsonb_array_elements(v_companions) with ordinality as c(value, ordinality);

  insert into public.booking_holds (booking_id, property_id, stay_range, status, expires_at)
  values (
    v_booking_id, p_property_id, daterange(p_check_in, p_check_out, '[)'), 'active', v_expires
  );

  insert into public.booking_events (
    booking_id, actor_id, source, event_type, old_status, new_status, reason, metadata
  )
  values (
    v_booking_id, null, 'guest', 'created', null, 'pending_payment', null,
    jsonb_build_object(
      'channel', 'affiliate',
      'companions', jsonb_array_length(v_companions),
      'totalMinor', v_total
    )
  );

  return jsonb_build_object(
    'bookingId', v_booking_id,
    'bookingCode', v_code,
    'currency', v_price ->> 'currency',
    'nights', (v_price ->> 'nights')::int,
    'nightlyMinor', v_property.affiliate_nightly_price_minor,
    'totalMinor', v_total,
    'checkIn', p_check_in,
    'checkOut', p_check_out
  );
exception
  when exclusion_violation then
    raise exception 'BOOKING_CONFLICT' using errcode = '23P01';
end;
$$;

-- ---------- Gestion administrativa ----------

create or replace function public.set_booking_companions(
  p_booking_id uuid,
  p_companions jsonb,
  p_actor_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_companions jsonb := coalesce(p_companions, '[]'::jsonb);
  v_count int;
begin
  if jsonb_typeof(v_companions) <> 'array' or jsonb_array_length(v_companions) > 20 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  perform 1 from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  delete from public.booking_companions where booking_id = p_booking_id;

  insert into public.booking_companions (booking_id, full_name, document_id, phone, sort_order)
  select
    p_booking_id,
    btrim(c.value ->> 'fullName'),
    upper(btrim(c.value ->> 'documentId')),
    nullif(btrim(coalesce(c.value ->> 'phone', '')), ''),
    (c.ordinality - 1)::int
  from jsonb_array_elements(v_companions) with ordinality as c(value, ordinality);

  v_count := jsonb_array_length(v_companions);

  insert into public.booking_events (
    booking_id, actor_id, source, event_type, old_status, new_status, reason, metadata
  )
  select p_booking_id, p_actor_id, 'admin', 'status_changed', b.status, b.status, null,
    jsonb_build_object('operation', 'companions_update', 'companions', v_count)
  from public.bookings b where b.id = p_booking_id;

  return jsonb_build_object('bookingId', p_booking_id, 'companions', v_count);
end;
$$;

create or replace function public.set_property_affiliate_pricing(
  p_property_id uuid,
  p_enabled boolean,
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
  if p_enabled and p_nightly_minor is null then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  update public.properties
  set affiliate_enabled = p_enabled,
      affiliate_nightly_price_minor = p_nightly_minor
  where id = p_property_id;

  insert into public.price_change_history (
    property_id, change_type, old_value, new_value, changed_by, reason
  )
  values (
    p_property_id, 'affiliate_price',
    jsonb_build_object(
      'enabled', v_old.affiliate_enabled,
      'nightlyMinor', v_old.affiliate_nightly_price_minor
    ),
    jsonb_build_object('enabled', p_enabled, 'nightlyMinor', p_nightly_minor),
    p_actor_id, nullif(btrim(coalesce(p_reason, '')), '')
  );

  return jsonb_build_object(
    'propertyId', p_property_id,
    'affiliateEnabled', p_enabled,
    'affiliateNightlyPriceMinor', p_nightly_minor
  );
end;
$$;

-- Reemplazo: una reserva de afiliado confirmada NO esta pagada (se cobra fuera
-- del sistema), asi que payment_status no debe pasar a 'paid'.
create or replace function public.confirm_booking_manual(
  p_booking_id uuid,
  p_reason text,
  p_actor_id uuid,
  p_source public.booking_event_source
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_b public.bookings%rowtype;
  v_hold_id uuid;
  v_payment_status public.booking_payment_status;
begin
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_b.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'status', 'confirmed');
  end if;
  if v_b.status not in ('pending_payment', 'manual_review') then
    raise exception 'BOOKING_INVALID_STATE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_b.property_id::text));

  update public.booking_holds
  set status = 'converted'
  where booking_id = p_booking_id and status = 'active'
  returning id into v_hold_id;
  if not found then
    raise exception 'BOOKING_EXPIRED' using errcode = 'P0001';
  end if;

  v_payment_status := case when v_b.channel = 'affiliate' then 'unpaid'::public.booking_payment_status
                           else 'paid'::public.booking_payment_status end;

  update public.bookings
  set status = 'confirmed', confirmed_at = now(), payment_status = v_payment_status
  where id = p_booking_id;

  insert into public.booking_events (booking_id, actor_id, source, event_type, old_status, new_status, reason, metadata)
  values (p_booking_id, p_actor_id, p_source, 'confirmed_manual', v_b.status, 'confirmed', p_reason,
    jsonb_build_object('channel', v_b.channel));

  return jsonb_build_object('ok', true, 'status', 'confirmed');
end;
$$;

-- Reemplazo: el canal afiliado no tiene email obligatorio, se tarifa plano y
-- nunca entra en la rama de reembolso por cambio de precio (nunca esta pagado).
create or replace function public.update_admin_booking(
  p_booking_id uuid,
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count int,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_hold_expires_at timestamptz,
  p_reason text,
  p_actor_id uuid,
  p_source public.booking_event_source
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_hold public.booking_holds%rowtype;
  v_price jsonb;
  v_item jsonb;
  v_old_total bigint;
  v_new_total bigint;
  v_new_status public.booking_status;
  v_new_payment_status public.booking_payment_status;
  v_is_affiliate boolean;
begin
  if p_check_in is null or p_check_out is null or p_check_in >= p_check_out then
    raise exception 'INVALID_DATES' using errcode = '22007';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_is_affiliate := v_booking.channel = 'affiliate';

  if p_guest_count is null or p_guest_count < 1
    or length(btrim(coalesce(p_guest_name, ''))) < 2
    or length(btrim(coalesce(p_reason, ''))) < 4
    or (not v_is_affiliate and length(btrim(coalesce(p_guest_email, ''))) < 3)
    or (v_is_affiliate and length(regexp_replace(coalesce(p_guest_phone, ''), '\D', '', 'g')) < 7) then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  if v_booking.status not in ('pending_payment', 'manual_review', 'confirmed') then
    raise exception 'BOOKING_INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_hold
  from public.booking_holds
  where booking_id = p_booking_id and status in ('active', 'converted')
  for update;
  if not found then
    raise exception 'BOOKING_EXPIRED' using errcode = 'P0001';
  end if;
  if v_hold.status = 'active' and not v_is_affiliate
    and (p_hold_expires_at is null or p_hold_expires_at <= now()) then
    raise exception 'INVALID_HOLD_EXPIRATION' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(least(v_booking.property_id::text, p_property_id::text)));
  if v_booking.property_id <> p_property_id then
    perform pg_advisory_xact_lock(hashtext(greatest(v_booking.property_id::text, p_property_id::text)));
  end if;

  perform 1
  from public.availability_blocks b
  where b.property_id = p_property_id
    and b.status = 'active'
    and b.stay_range && daterange(p_check_in, p_check_out, '[)')
  limit 1;
  if found then
    raise exception 'AVAILABILITY_BLOCKED' using errcode = 'P0001';
  end if;

  if v_is_affiliate then
    v_price := public.calculate_affiliate_booking_price(
      p_property_id, p_check_in, p_check_out, p_guest_count
    );
    -- El bloqueo de afiliado vence en la hora de salida, no por temporizador.
    p_hold_expires_at := (
      (p_check_out::timestamp + (select check_out_time from public.properties where id = p_property_id))
      at time zone 'America/La_Paz'
    );
  else
    v_price := public.calculate_booking_price(
      p_property_id, p_check_in, p_check_out, p_guest_count
    );
  end if;

  v_old_total := v_booking.total_minor;
  v_new_total := (v_price ->> 'totalMinor')::bigint;
  v_new_status := v_booking.status;
  v_new_payment_status := v_booking.payment_status;

  if not v_is_affiliate and v_booking.payment_status = 'paid' and v_new_total <> v_old_total then
    v_new_status := 'manual_review';
    v_new_payment_status := 'refund_required';
  end if;

  update public.booking_holds
  set property_id = p_property_id,
      stay_range = daterange(p_check_in, p_check_out, '[)'),
      expires_at = case when v_hold.status = 'active' then p_hold_expires_at else expires_at end
  where id = v_hold.id;

  update public.bookings
  set property_id = p_property_id,
      guest_name = btrim(p_guest_name),
      guest_email = case when v_is_affiliate
        then nullif(lower(btrim(coalesce(p_guest_email, ''))), '')
        else lower(btrim(p_guest_email)) end,
      guest_phone = nullif(btrim(coalesce(p_guest_phone, '')), ''),
      check_in = p_check_in,
      check_out = p_check_out,
      guests = p_guest_count,
      nights = (v_price ->> 'nights')::int,
      currency = v_price ->> 'currency',
      subtotal_minor = (v_price ->> 'subtotalMinor')::bigint,
      cleaning_fee_minor = coalesce((v_price ->> 'cleaningFeeMinor')::bigint, 0),
      service_fee_minor = coalesce((v_price ->> 'serviceFeeMinor')::bigint, 0),
      discount_minor = coalesce((v_price ->> 'discountMinor')::bigint, 0),
      total_minor = v_new_total,
      status = v_new_status,
      payment_status = v_new_payment_status,
      hold_expires_at = case when v_hold.status = 'active' then p_hold_expires_at else null end
  where id = p_booking_id;

  delete from public.booking_price_items where booking_id = p_booking_id;
  for v_item in select * from jsonb_array_elements(v_price -> 'items')
  loop
    insert into public.booking_price_items (
      booking_id, type, description, quantity, unit_amount_minor, total_amount_minor
    )
    values (
      p_booking_id,
      (v_item ->> 'type')::public.price_item_type,
      v_item ->> 'description',
      (v_item ->> 'quantity')::int,
      (v_item ->> 'unitAmountMinor')::bigint,
      (v_item ->> 'totalAmountMinor')::bigint
    );
  end loop;

  insert into public.booking_events (
    booking_id, actor_id, source, event_type, old_status, new_status, reason, metadata
  )
  values (
    p_booking_id, p_actor_id, p_source, 'status_changed',
    v_booking.status, v_new_status, p_reason,
    jsonb_build_object(
      'operation', 'admin_update',
      'channel', v_booking.channel,
      'oldPropertyId', v_booking.property_id,
      'newPropertyId', p_property_id,
      'oldCheckIn', v_booking.check_in,
      'oldCheckOut', v_booking.check_out,
      'newCheckIn', p_check_in,
      'newCheckOut', p_check_out,
      'oldTotalMinor', v_old_total,
      'newTotalMinor', v_new_total,
      'priceAdjustmentRequired', v_new_payment_status = 'refund_required'
    )
  );

  return jsonb_build_object(
    'bookingId', p_booking_id,
    'status', v_new_status,
    'paymentStatus', v_new_payment_status,
    'totalMinor', v_new_total,
    'priceAdjustmentRequired', v_new_payment_status = 'refund_required'
  );
exception
  when exclusion_violation then
    raise exception 'BOOKING_CONFLICT' using errcode = '23P01';
end;
$$;

-- ---------- Permisos ----------

revoke all on function public.calculate_affiliate_booking_price(uuid, date, date, int) from public;
grant execute on function public.calculate_affiliate_booking_price(uuid, date, date, int)
  to anon, authenticated, service_role;

revoke all on function public.create_affiliate_booking_request(
  uuid, date, date, int, text, text, text, text, jsonb, int
) from public;
grant execute on function public.create_affiliate_booking_request(
  uuid, date, date, int, text, text, text, text, jsonb, int
) to anon, authenticated, service_role;

revoke all on function public.set_booking_companions(uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.set_booking_companions(uuid, jsonb, uuid) to service_role;

revoke all on function public.set_property_affiliate_pricing(uuid, boolean, bigint, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_property_affiliate_pricing(uuid, boolean, bigint, text, uuid)
  to service_role;

revoke all on function public.confirm_booking_manual(uuid, text, uuid, public.booking_event_source)
  from public, anon, authenticated;
grant execute on function public.confirm_booking_manual(uuid, text, uuid, public.booking_event_source)
  to service_role;

revoke all on function public.update_admin_booking(
  uuid, uuid, date, date, int, text, text, text, timestamptz, text, uuid, public.booking_event_source
) from public, anon, authenticated;
grant execute on function public.update_admin_booking(
  uuid, uuid, date, date, int, text, text, text, timestamptz, text, uuid, public.booking_event_source
) to service_role;
