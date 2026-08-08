-- Tablero administrativo de disponibilidad y reservas.
-- No agrega tablas ni columnas: concentra las mutaciones operativas en RPC
-- transaccionales, elimina la escritura directa de bookings y programa los
-- barridos de expiracion ya existentes.

create or replace function public.create_admin_booking(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count int,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_access_token_hash text,
  p_hold_expires_at timestamptz,
  p_kind text,
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
  v_price jsonb;
  v_booking_id uuid;
  v_code text;
  v_nights int;
  v_total bigint;
  v_hold_status public.hold_status;
  v_booking_status public.booking_status;
  v_payment_status public.booking_payment_status;
  v_expires timestamptz;
  v_item jsonb;
begin
  if p_kind not in ('pre_reservation', 'rental') then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  if p_check_in is null or p_check_out is null or p_check_in >= p_check_out then
    raise exception 'INVALID_DATES' using errcode = '22007';
  end if;
  if p_guest_count is null or p_guest_count < 1 then
    raise exception 'GUEST_CAPACITY' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_guest_name, ''))) < 2
    or length(btrim(coalesce(p_guest_email, ''))) < 3 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  if p_kind = 'pre_reservation' then
    if p_hold_expires_at is null or p_hold_expires_at <= now()
      or length(btrim(coalesce(p_access_token_hash, ''))) = 0 then
      raise exception 'INVALID_HOLD_EXPIRATION' using errcode = 'P0001';
    end if;
    v_hold_status := 'active';
    v_booking_status := 'pending_payment';
    v_payment_status := 'unpaid';
    v_expires := p_hold_expires_at;
  else
    if length(btrim(coalesce(p_reason, ''))) < 4 then
      raise exception 'REASON_REQUIRED' using errcode = 'P0001';
    end if;
    v_hold_status := 'converted';
    v_booking_status := 'confirmed';
    v_payment_status := 'paid';
    v_expires := now();
  end if;

  v_price := public.calculate_booking_price(
    p_property_id, p_check_in, p_check_out, p_guest_count
  );
  v_nights := (v_price ->> 'nights')::int;
  v_total := (v_price ->> 'totalMinor')::bigint;
  v_code := public.generate_booking_code();

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
    booking_code, property_id, guest_name, guest_email, guest_phone,
    check_in, check_out, guests, nights, currency,
    subtotal_minor, cleaning_fee_minor, service_fee_minor, discount_minor,
    total_minor, status, payment_status, access_token_hash,
    hold_expires_at, confirmed_at
  )
  values (
    v_code, p_property_id, btrim(p_guest_name), lower(btrim(p_guest_email)),
    nullif(btrim(coalesce(p_guest_phone, '')), ''),
    p_check_in, p_check_out, p_guest_count, v_nights, v_price ->> 'currency',
    (v_price ->> 'subtotalMinor')::bigint,
    coalesce((v_price ->> 'cleaningFeeMinor')::bigint, 0),
    coalesce((v_price ->> 'serviceFeeMinor')::bigint, 0),
    coalesce((v_price ->> 'discountMinor')::bigint, 0),
    v_total, v_booking_status, v_payment_status,
    case when p_kind = 'pre_reservation' then p_access_token_hash else null end,
    case when p_kind = 'pre_reservation' then v_expires else null end,
    case when p_kind = 'rental' then now() else null end
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

  insert into public.booking_holds (
    booking_id, property_id, stay_range, status, expires_at
  )
  values (
    v_booking_id, p_property_id, daterange(p_check_in, p_check_out, '[)'),
    v_hold_status, v_expires
  );

  insert into public.booking_events (
    booking_id, actor_id, source, event_type, old_status, new_status, reason, metadata
  )
  values (
    v_booking_id, p_actor_id, p_source,
    case when p_kind = 'rental'
      then 'confirmed_manual'::public.booking_event_type
      else 'created'::public.booking_event_type end,
    null, v_booking_status, nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object('kind', p_kind, 'totalMinor', v_total)
  );

  return jsonb_build_object(
    'bookingId', v_booking_id,
    'bookingCode', v_code,
    'status', v_booking_status,
    'paymentStatus', v_payment_status,
    'totalMinor', v_total,
    'holdExpiresAt', case when p_kind = 'pre_reservation' then v_expires else null end
  );
exception
  when exclusion_violation then
    raise exception 'BOOKING_CONFLICT' using errcode = '23P01';
end;
$$;

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
begin
  if p_check_in is null or p_check_out is null or p_check_in >= p_check_out then
    raise exception 'INVALID_DATES' using errcode = '22007';
  end if;
  if p_guest_count is null or p_guest_count < 1
    or length(btrim(coalesce(p_guest_name, ''))) < 2
    or length(btrim(coalesce(p_guest_email, ''))) < 3
    or length(btrim(coalesce(p_reason, ''))) < 4 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
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
  if v_hold.status = 'active'
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

  v_price := public.calculate_booking_price(
    p_property_id, p_check_in, p_check_out, p_guest_count
  );
  v_old_total := v_booking.total_minor;
  v_new_total := (v_price ->> 'totalMinor')::bigint;
  v_new_status := v_booking.status;
  v_new_payment_status := v_booking.payment_status;

  if v_booking.payment_status = 'paid' and v_new_total <> v_old_total then
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
      guest_email = lower(btrim(p_guest_email)),
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

create or replace function public.update_availability_block(
  p_block_id uuid,
  p_property_id uuid,
  p_from date,
  p_to date,
  p_type public.availability_block_type,
  p_reason text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_block public.availability_blocks%rowtype;
begin
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'INVALID_DATES' using errcode = '22007';
  end if;

  select * into v_block
  from public.availability_blocks
  where id = p_block_id
  for update;
  if not found then
    raise exception 'AVAILABILITY_BLOCK_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_block.status <> 'active' then
    raise exception 'AVAILABILITY_BLOCK_INACTIVE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(least(v_block.property_id::text, p_property_id::text)));
  if v_block.property_id <> p_property_id then
    perform pg_advisory_xact_lock(hashtext(greatest(v_block.property_id::text, p_property_id::text)));
  end if;

  perform 1
  from public.booking_holds h
  where h.property_id = p_property_id
    and h.status in ('active', 'converted')
    and h.stay_range && daterange(p_from, p_to, '[)')
  limit 1;
  if found then
    raise exception 'BOOKING_CONFLICT' using errcode = '23P01';
  end if;

  update public.availability_blocks
  set property_id = p_property_id,
      stay_range = daterange(p_from, p_to, '[)'),
      type = p_type,
      reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_block_id;

  return jsonb_build_object(
    'blockId', p_block_id,
    'status', 'active',
    'actorId', p_actor_id
  );
exception
  when exclusion_violation then
    raise exception 'AVAILABILITY_BLOCK_CONFLICT' using errcode = '23P01';
end;
$$;

-- La UI administrativa ya usa RPC server-side; se cierra el bypass de UPDATE
-- directo para sesiones staff.
drop policy if exists bookings_staff_write on public.bookings;

revoke all on function public.create_admin_booking(
  uuid, date, date, int, text, text, text, text, timestamptz, text, text, uuid,
  public.booking_event_source
) from public, anon, authenticated;
grant execute on function public.create_admin_booking(
  uuid, date, date, int, text, text, text, text, timestamptz, text, text, uuid,
  public.booking_event_source
) to service_role;

revoke all on function public.update_admin_booking(
  uuid, uuid, date, date, int, text, text, text, timestamptz, text, uuid,
  public.booking_event_source
) from public, anon, authenticated;
grant execute on function public.update_admin_booking(
  uuid, uuid, date, date, int, text, text, text, timestamptz, text, uuid,
  public.booking_event_source
) to service_role;

revoke all on function public.update_availability_block(
  uuid, uuid, date, date, public.availability_block_type, text, uuid
) from public, anon, authenticated;
grant execute on function public.update_availability_block(
  uuid, uuid, date, date, public.availability_block_type, text, uuid
) to service_role;

-- Supabase Cron usa pg_cron. No se fija version de extension: el changelog de
-- Supabase depreca el version pinning y cron.job no debe editarse directamente.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('rentamar-expire-stale-availability');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'rentamar-expire-stale-availability',
  '*/5 * * * *',
  $cron$
    select public.expire_stale_holds(), public.expire_stale_payments();
  $cron$
);
