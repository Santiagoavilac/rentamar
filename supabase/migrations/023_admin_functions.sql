-- Fase 3 — RPC administrativas. Todas SECURITY DEFINER con search_path fijo.
-- Se ejecutan SOLO desde el servidor con el cliente admin (service_role), igual que
-- los RPC de pago (016/018). La autorización de rol (admin vs operator) se hace en
-- la capa de aplicación (assertAdminAction) antes de invocarlas; por eso aquí no se
-- llama is_staff() (auth.uid() es null bajo service_role). El EXECUTE queda revocado
-- a public/anon/authenticated. El actor se pasa explícito (p_actor_id) para la
-- bitácora, ya que auth.uid() no está disponible en este contexto.
-- La escritura de audit_logs (sanitizada, con IP hasheada) la hace la capa de app.

-- ---------- Disponibilidad ----------

create or replace function public.create_availability_block(
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
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_from >= p_to then
    raise exception 'INVALID_DATES' using errcode = '22007';
  end if;
  if p_from < current_date then
    raise exception 'INVALID_DATES_PAST' using errcode = '22007';
  end if;
  perform 1 from public.properties where id = p_property_id;
  if not found then
    raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Serializa hold<->block por propiedad.
  perform pg_advisory_xact_lock(hashtext(p_property_id::text));

  -- No se puede bloquear sobre una reserva vigente (hold active vigente o converted).
  perform 1 from public.booking_holds h
    where h.property_id = p_property_id
      and (h.status = 'converted' or (h.status = 'active' and h.expires_at > now()))
      and h.stay_range && daterange(p_from, p_to, '[)')
    limit 1;
  if found then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  begin
    insert into public.availability_blocks (property_id, stay_range, type, status, reason, created_by)
    values (p_property_id, daterange(p_from, p_to, '[)'), coalesce(p_type, 'manual'), 'active', p_reason, p_actor_id)
    returning id into v_id;
  exception
    when exclusion_violation then
      raise exception 'BOOKING_CONFLICT' using errcode = '23P01';
  end;

  return jsonb_build_object('blockId', v_id, 'status', 'active');
end;
$$;

create or replace function public.release_availability_block(
  p_block_id uuid,
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
  v_prop uuid;
begin
  update public.availability_blocks
  set status = 'released', released_by = p_actor_id, released_at = now()
  where id = p_block_id and status = 'active'
  returning property_id into v_prop;
  if not found then
    raise exception 'BLOCK_NOT_FOUND' using errcode = 'P0002';
  end if;
  return jsonb_build_object('blockId', p_block_id, 'status', 'released');
end;
$$;

-- ---------- Reservas ----------

create or replace function public.cancel_booking(
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
  v_refund boolean := false;
  v_new_pay public.booking_payment_status;
begin
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Idempotente.
  if v_b.status = 'cancelled' then
    return jsonb_build_object('ok', true, 'status', 'cancelled',
      'refundRequired', v_b.payment_status = 'refund_required');
  end if;
  if v_b.status = 'completed' then
    raise exception 'BOOKING_INVALID_STATE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_b.property_id::text));

  if v_b.payment_status = 'paid' then
    v_refund := true;
    v_new_pay := 'refund_required';
  else
    v_new_pay := v_b.payment_status;
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_at = now(), payment_status = v_new_pay
  where id = p_booking_id;

  -- Libera las fechas. No se tocan las filas de payments (se preserva el historial).
  update public.booking_holds
  set status = 'released', released_at = now()
  where booking_id = p_booking_id and status in ('active', 'converted');

  insert into public.booking_events (booking_id, actor_id, source, event_type, old_status, new_status, reason, metadata)
  values (p_booking_id, p_actor_id, p_source, 'cancelled', v_b.status, 'cancelled', p_reason,
    jsonb_build_object('refundRequired', v_refund));

  return jsonb_build_object('ok', true, 'status', 'cancelled', 'refundRequired', v_refund);
end;
$$;

create or replace function public.expire_booking_admin(
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
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_b.status <> 'pending_payment' then
    raise exception 'BOOKING_INVALID_STATE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_b.property_id::text));

  update public.bookings
  set status = 'expired', payment_status = 'expired'
  where id = p_booking_id;

  update public.booking_holds
  set status = 'expired', released_at = now()
  where booking_id = p_booking_id and status = 'active';

  insert into public.booking_events (booking_id, actor_id, source, event_type, old_status, new_status, reason)
  values (p_booking_id, p_actor_id, p_source, 'expired', v_b.status, 'expired', p_reason);

  return jsonb_build_object('ok', true, 'status', 'expired');
end;
$$;

create or replace function public.mark_booking_manual_review(
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
begin
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_b.status in ('cancelled', 'completed', 'expired') then
    raise exception 'BOOKING_INVALID_STATE' using errcode = 'P0001';
  end if;
  if v_b.status = 'manual_review' then
    return jsonb_build_object('ok', true, 'status', 'manual_review');
  end if;

  -- No libera el hold: mantiene las fechas reservadas mientras se revisa.
  update public.bookings set status = 'manual_review' where id = p_booking_id;

  insert into public.booking_events (booking_id, actor_id, source, event_type, old_status, new_status, reason)
  values (p_booking_id, p_actor_id, p_source, 'manual_review', v_b.status, 'manual_review', p_reason);

  return jsonb_build_object('ok', true, 'status', 'manual_review');
end;
$$;

-- Confirmación manual (p. ej. pago offline). Solo admin (validado en la app).
-- Exige un hold active vigente; lo convierte. Operación explícita y muy auditada.
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

  update public.bookings
  set status = 'confirmed', confirmed_at = now(), payment_status = 'paid'
  where id = p_booking_id;

  insert into public.booking_events (booking_id, actor_id, source, event_type, old_status, new_status, reason)
  values (p_booking_id, p_actor_id, p_source, 'confirmed_manual', v_b.status, 'confirmed', p_reason);

  return jsonb_build_object('ok', true, 'status', 'confirmed');
end;
$$;

-- ---------- Precios ----------

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
  select base_price_minor into v_old from public.properties where id = p_property_id for update;
  if not found then
    raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.properties set base_price_minor = p_new_minor where id = p_property_id;

  insert into public.price_change_history (property_id, change_type, old_value, new_value, changed_by, reason)
  values (p_property_id, 'base_price',
    jsonb_build_object('basePriceMinor', v_old),
    jsonb_build_object('basePriceMinor', p_new_minor),
    p_actor_id, p_reason);

  return jsonb_build_object('propertyId', p_property_id, 'basePriceMinor', p_new_minor);
end;
$$;

create or replace function public.create_property_rate(
  p_property_id uuid,
  p_start date,
  p_end date,
  p_price_minor bigint,
  p_minimum_nights int,
  p_label text,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_start >= p_end then
    raise exception 'INVALID_DATES' using errcode = '22007';
  end if;
  if p_price_minor <= 0 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  perform 1 from public.properties where id = p_property_id;
  if not found then
    raise exception 'PROPERTY_NOT_FOUND' using errcode = 'P0002';
  end if;

  begin
    insert into public.property_rates (property_id, start_date, end_date, nightly_price_minor, minimum_nights, label)
    values (p_property_id, p_start, p_end, p_price_minor, p_minimum_nights, p_label)
    returning id into v_id;
  exception
    when exclusion_violation then
      raise exception 'RATE_OVERLAP' using errcode = '23P01';
  end;

  insert into public.price_change_history (property_id, property_rate_id, change_type, old_value, new_value, changed_by, reason)
  values (p_property_id, v_id, 'rate_create', null,
    jsonb_build_object('startDate', p_start, 'endDate', p_end, 'nightlyPriceMinor', p_price_minor,
      'minimumNights', p_minimum_nights, 'label', p_label),
    p_actor_id, p_reason);

  return jsonb_build_object('rateId', v_id);
end;
$$;

create or replace function public.update_property_rate(
  p_rate_id uuid,
  p_start date,
  p_end date,
  p_price_minor bigint,
  p_minimum_nights int,
  p_label text,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.property_rates%rowtype;
begin
  if p_start >= p_end then
    raise exception 'INVALID_DATES' using errcode = '22007';
  end if;
  if p_price_minor <= 0 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  select * into v_old from public.property_rates where id = p_rate_id for update;
  if not found then
    raise exception 'RATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  begin
    update public.property_rates
    set start_date = p_start, end_date = p_end, nightly_price_minor = p_price_minor,
        minimum_nights = p_minimum_nights, label = p_label
    where id = p_rate_id;
  exception
    when exclusion_violation then
      raise exception 'RATE_OVERLAP' using errcode = '23P01';
  end;

  insert into public.price_change_history (property_id, property_rate_id, change_type, old_value, new_value, changed_by, reason)
  values (v_old.property_id, p_rate_id, 'rate_update',
    jsonb_build_object('startDate', v_old.start_date, 'endDate', v_old.end_date,
      'nightlyPriceMinor', v_old.nightly_price_minor, 'minimumNights', v_old.minimum_nights, 'label', v_old.label),
    jsonb_build_object('startDate', p_start, 'endDate', p_end, 'nightlyPriceMinor', p_price_minor,
      'minimumNights', p_minimum_nights, 'label', p_label),
    p_actor_id, p_reason);

  return jsonb_build_object('rateId', p_rate_id);
end;
$$;

create or replace function public.remove_property_rate(
  p_rate_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.property_rates%rowtype;
begin
  select * into v_old from public.property_rates where id = p_rate_id for update;
  if not found then
    raise exception 'RATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  delete from public.property_rates where id = p_rate_id;

  insert into public.price_change_history (property_id, property_rate_id, change_type, old_value, new_value, changed_by, reason)
  values (v_old.property_id, null, 'rate_remove',
    jsonb_build_object('startDate', v_old.start_date, 'endDate', v_old.end_date,
      'nightlyPriceMinor', v_old.nightly_price_minor, 'minimumNights', v_old.minimum_nights, 'label', v_old.label),
    null, p_actor_id, p_reason);

  return jsonb_build_object('rateId', p_rate_id, 'removed', true);
end;
$$;

-- ---------- Usuarios ----------

create or replace function public.change_user_role(
  p_user_id uuid,
  p_new_role public.user_role,
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
  v_old public.user_role;
  v_admins int;
begin
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_old = p_new_role then
    return jsonb_build_object('userId', p_user_id, 'role', p_new_role);
  end if;

  -- No dejar el sistema sin admins.
  if v_old = 'admin' and p_new_role <> 'admin' then
    select count(*) into v_admins from public.profiles where role = 'admin';
    if v_admins <= 1 then
      raise exception 'LAST_ADMIN' using errcode = 'P0001';
    end if;
  end if;

  -- El trigger enforce_profile_role_immutable permite el cambio porque bajo
  -- service_role auth.uid() es null.
  update public.profiles set role = p_new_role where id = p_user_id;

  return jsonb_build_object('userId', p_user_id, 'role', p_new_role, 'oldRole', v_old);
end;
$$;

-- ---------- Reemplazo de create_booking_with_hold: suma advisory lock + bloqueos ----------
-- Misma firma que 007. Agrega la coordinación con availability_blocks: una reserva
-- de invitado no puede solapar un bloqueo active. El exclusion constraint de
-- booking_holds sigue gobernando el solape reserva<->reserva.
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

  -- Serializa hold<->block por propiedad y rechaza solapes con bloqueos active.
  perform pg_advisory_xact_lock(hashtext(p_property_id::text));
  perform 1 from public.availability_blocks b
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

-- ---------- Permisos: solo service_role (orquestación server-side) ----------
revoke all on function public.create_availability_block(uuid, date, date, public.availability_block_type, text, uuid) from public;
grant execute on function public.create_availability_block(uuid, date, date, public.availability_block_type, text, uuid) to service_role;

revoke all on function public.release_availability_block(uuid, text, uuid) from public;
grant execute on function public.release_availability_block(uuid, text, uuid) to service_role;

revoke all on function public.cancel_booking(uuid, text, uuid, public.booking_event_source) from public;
grant execute on function public.cancel_booking(uuid, text, uuid, public.booking_event_source) to service_role;

revoke all on function public.expire_booking_admin(uuid, text, uuid, public.booking_event_source) from public;
grant execute on function public.expire_booking_admin(uuid, text, uuid, public.booking_event_source) to service_role;

revoke all on function public.mark_booking_manual_review(uuid, text, uuid, public.booking_event_source) from public;
grant execute on function public.mark_booking_manual_review(uuid, text, uuid, public.booking_event_source) to service_role;

revoke all on function public.confirm_booking_manual(uuid, text, uuid, public.booking_event_source) from public;
grant execute on function public.confirm_booking_manual(uuid, text, uuid, public.booking_event_source) to service_role;

revoke all on function public.change_property_base_price(uuid, bigint, text, uuid) from public;
grant execute on function public.change_property_base_price(uuid, bigint, text, uuid) to service_role;

revoke all on function public.create_property_rate(uuid, date, date, bigint, int, text, uuid, text) from public;
grant execute on function public.create_property_rate(uuid, date, date, bigint, int, text, uuid, text) to service_role;

revoke all on function public.update_property_rate(uuid, date, date, bigint, int, text, uuid, text) from public;
grant execute on function public.update_property_rate(uuid, date, date, bigint, int, text, uuid, text) to service_role;

revoke all on function public.remove_property_rate(uuid, uuid, text) from public;
grant execute on function public.remove_property_rate(uuid, uuid, text) to service_role;

revoke all on function public.change_user_role(uuid, public.user_role, text, uuid) from public;
grant execute on function public.change_user_role(uuid, public.user_role, text, uuid) to service_role;
