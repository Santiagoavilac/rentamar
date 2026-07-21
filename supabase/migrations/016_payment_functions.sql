-- Fase 2 — Funciones de pago. Todas SECURITY DEFINER con search_path fijo.
-- Se ejecutan solo desde el servidor (cliente admin / service_role).

-- Crea (o reutiliza) el intento de pago activo de una reserva. Lockea la fila de
-- la reserva para serializar creaciones concurrentes; el índice único parcial
-- payments_one_active_per_booking es el backstop. Devuelve { isNew, paymentId }.
create or replace function public.create_payment_intent(
  p_booking_id uuid,
  p_provider public.payment_provider,
  p_provider_mode text,
  p_method public.payment_method,
  p_idempotency_key text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_hold public.booking_holds%rowtype;
  v_existing public.payments%rowtype;
  v_payment_id uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_booking.status = 'confirmed' or v_booking.payment_status = 'paid' then
    raise exception 'PAYMENT_ALREADY_PAID' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'pending_payment' then
    raise exception 'PAYMENT_INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_hold from public.booking_holds
    where booking_id = p_booking_id and status = 'active'
    order by created_at desc limit 1;
  if not found or v_hold.expires_at <= now() then
    raise exception 'PAYMENT_INVALID_STATE' using errcode = 'P0001';
  end if;

  -- ¿Ya hay un pago activo? Reutilizarlo (idempotencia ante doble clic / retries).
  select * into v_existing from public.payments
    where booking_id = p_booking_id and status in ('created', 'pending')
    order by created_at desc limit 1;
  if found then
    return jsonb_build_object('isNew', false, 'paymentId', v_existing.id);
  end if;

  -- ¿Pago ya pagado? No permitir otro.
  perform 1 from public.payments where booking_id = p_booking_id and status = 'paid' limit 1;
  if found then
    raise exception 'PAYMENT_ALREADY_PAID' using errcode = 'P0001';
  end if;

  insert into public.payments (
    booking_id, provider, provider_mode, method, status,
    amount_minor, currency, expires_at, idempotency_key
  )
  values (
    p_booking_id, p_provider, p_provider_mode, p_method, 'created',
    v_booking.total_minor, v_booking.currency, p_expires_at, p_idempotency_key
  )
  returning id into v_payment_id;

  update public.bookings set payment_status = 'pending' where id = p_booking_id;

  insert into public.payment_events (payment_id, booking_id, source, event_type, new_status)
  values (v_payment_id, p_booking_id, 'create', 'payment_created', 'created');

  return jsonb_build_object('isNew', true, 'paymentId', v_payment_id);
end;
$$;

-- Adjunta los datos del proveedor (externalId, QR) y pasa el pago a 'pending'.
-- Guardado idempotente: solo escribe si aún no hay external_id.
create or replace function public.attach_payment_provider_data(
  p_payment_id uuid,
  p_external_id text,
  p_qr_image_base64 text,
  p_qr_mime_type text,
  p_qr_code text,
  p_provider_status_code text,
  p_raw jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking_id uuid;
  v_updated int;
begin
  update public.payments
  set external_id = p_external_id,
      external_qr_code = p_qr_code,
      qr_image_base64 = p_qr_image_base64,
      qr_mime_type = p_qr_mime_type,
      provider_status_code = p_provider_status_code,
      create_response_raw = p_raw,
      status = 'pending'
  where id = p_payment_id and external_id is null
  returning booking_id into v_booking_id;

  get diagnostics v_updated = row_count;
  if v_updated > 0 then
    insert into public.payment_events (payment_id, booking_id, source, event_type, old_status, new_status, provider_status_code)
    values (p_payment_id, v_booking_id, 'create', 'provider_attached', 'created', 'pending', p_provider_status_code);
  end if;
end;
$$;

-- Confirmación transaccional. Idempotente: si ya está pagado devuelve el estado
-- final. Ante mismatch de monto marca manual_review (sin confirmar). Ante hold
-- inválido o estado incorrecto, lanza excepción (rollback, sin confirmar).
create or replace function public.confirm_booking_payment(p_payment_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_hold public.booking_holds%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Idempotente.
  if v_payment.status = 'paid' then
    return jsonb_build_object('ok', true, 'paymentStatus', 'paid',
      'bookingStatus', 'confirmed', 'paidAt', v_payment.paid_at);
  end if;

  if v_payment.status not in ('pending', 'created') then
    raise exception 'PAYMENT_INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = v_payment.booking_id for update;

  -- Mismatch de monto: no confirmar, marcar manual_review y persistir.
  if v_payment.amount_minor <> v_booking.total_minor then
    update public.payments set status = 'manual_review' where id = p_payment_id;
    update public.bookings set status = 'manual_review', payment_status = 'failed'
      where id = v_booking.id;
    insert into public.payment_events (payment_id, booking_id, source, event_type, old_status, new_status, error_code)
    values (p_payment_id, v_booking.id, 'manual_verify', 'amount_mismatch', v_payment.status, 'manual_review', 'PAYMENT_AMOUNT_MISMATCH');
    return jsonb_build_object('ok', false, 'reason', 'PAYMENT_AMOUNT_MISMATCH',
      'paymentStatus', 'manual_review', 'bookingStatus', 'manual_review');
  end if;

  if v_booking.status <> 'pending_payment' then
    raise exception 'PAYMENT_INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_hold from public.booking_holds
    where booking_id = v_booking.id and status = 'active'
    order by created_at desc limit 1;
  if not found or v_hold.expires_at <= now() then
    raise exception 'PAYMENT_INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.payments set status = 'paid', paid_at = now() where id = p_payment_id;
  update public.bookings set status = 'confirmed', confirmed_at = now(), payment_status = 'paid'
    where id = v_booking.id;
  update public.booking_holds set status = 'converted' where id = v_hold.id;

  insert into public.payment_events (payment_id, booking_id, source, event_type, old_status, new_status)
  values (p_payment_id, v_booking.id, 'manual_verify', 'payment_confirmed', v_payment.status, 'paid');

  return jsonb_build_object('ok', true, 'paymentStatus', 'paid',
    'bookingStatus', 'confirmed', 'paidAt', now());
end;
$$;

-- Marca un pago 'error' (verify vio error en el proveedor). No confirma.
create or replace function public.record_payment_error(
  p_payment_id uuid,
  p_provider_status_code text,
  p_raw jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_payment.status not in ('pending', 'created') then
    return;
  end if;

  update public.payments
  set status = 'error', failed_at = now(),
      provider_status_code = p_provider_status_code,
      last_status_response_raw = p_raw,
      last_provider_check_at = now()
  where id = p_payment_id;

  update public.bookings set payment_status = 'failed' where id = v_payment.booking_id;

  insert into public.payment_events (payment_id, booking_id, source, event_type, old_status, new_status, provider_status_code)
  values (p_payment_id, v_payment.booking_id, 'manual_verify', 'payment_error', v_payment.status, 'error', p_provider_status_code);
end;
$$;

-- Expira un pago y, si su reserva sigue pendiente sin otro pago activo, expira la
-- reserva y libera el hold (fechas disponibles de nuevo).
create or replace function public.expire_payment(p_payment_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_other int;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.status not in ('created', 'pending') then
    return false;
  end if;

  update public.payments set status = 'expired' where id = p_payment_id;
  insert into public.payment_events (payment_id, booking_id, source, event_type, old_status, new_status)
  values (p_payment_id, v_payment.booking_id, 'cron', 'payment_expired', v_payment.status, 'expired');

  -- ¿Queda algún otro pago activo para esta reserva?
  select count(*) into v_other from public.payments
    where booking_id = v_payment.booking_id and status in ('created', 'pending');

  if v_other = 0 then
    update public.bookings
    set status = 'expired', payment_status = 'expired'
    where id = v_payment.booking_id and status = 'pending_payment';

    update public.booking_holds
    set status = 'expired', released_at = now()
    where booking_id = v_payment.booking_id and status = 'active';
  end if;

  return true;
end;
$$;

-- Barrido de pagos vencidos (gobierna reservas CON pago).
create or replace function public.expire_stale_payments()
returns int
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select id from public.payments
    where status in ('created', 'pending') and expires_at <= now()
  loop
    if public.expire_payment(v_id) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Reemplazo: expire_stale_holds ahora barre SOLO reservas sin pago activo
-- (abandono pre-pago). Las reservas con pago las gobierna expire_stale_payments.
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
    update public.booking_holds h
    set status = 'expired', released_at = now()
    where h.status = 'active' and h.expires_at <= now()
      and not exists (
        select 1 from public.payments p
        where p.booking_id = h.booking_id and p.status in ('created', 'pending')
      )
    returning h.booking_id
  )
  update public.bookings b
  set status = 'expired'
  from expired e
  where b.id = e.booking_id and b.status = 'pending_payment';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Permisos: solo service_role (orquestación server-side). Nunca anon/authenticated.
revoke all on function public.create_payment_intent(uuid, public.payment_provider, text, public.payment_method, text, timestamptz) from public;
grant execute on function public.create_payment_intent(uuid, public.payment_provider, text, public.payment_method, text, timestamptz) to service_role;

revoke all on function public.attach_payment_provider_data(uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.attach_payment_provider_data(uuid, text, text, text, text, text, jsonb) to service_role;

revoke all on function public.confirm_booking_payment(uuid) from public;
grant execute on function public.confirm_booking_payment(uuid) to service_role;

revoke all on function public.record_payment_error(uuid, text, jsonb) from public;
grant execute on function public.record_payment_error(uuid, text, jsonb) to service_role;

revoke all on function public.expire_payment(uuid) from public;
grant execute on function public.expire_payment(uuid) to service_role;

revoke all on function public.expire_stale_payments() from public;
grant execute on function public.expire_stale_payments() to service_role;
