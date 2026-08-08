-- Máquina de estados para comprobantes verificados por IA. Todas SECURITY DEFINER
-- con search_path fijo, solo service_role. Reutilizan la lógica de pagos existente.

-- Aplica el resultado de la IA (1..4) sobre un pago. El servidor ya subió el
-- comprobante e insertó payment_receipts; acá solo se decide el estado.
--   2 + modo 'auto'  → confirma la reserva (delegado a confirm_booking_payment).
--   2 + modo 'admin' → payment 'ai_approved'; la reserva sigue pending_payment
--                      hasta que un humano confirme (Modo B).
--   1                → sin cambio de estado (permite reintento).
--   3 (fuera de plazo) / 4 (error) / IA no disponible → manual_review.
-- En ai_approved y manual_review se extiende el vencimiento del hold y del pago
-- para que los barridos automáticos no liberen las fechas antes de la decisión.
create or replace function public.apply_receipt_result(
  p_payment_id uuid,
  p_receipt_id uuid,
  p_result smallint,
  p_mode text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_meta jsonb := jsonb_build_object('receiptId', p_receipt_id, 'aiResult', p_result);
  v_hold_extension timestamptz := now() + interval '7 days';
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Idempotencia: si el pago ya está resuelto no se reprocesa.
  if v_payment.status in ('paid', 'ai_approved', 'manual_review', 'cancelled', 'refunded') then
    return jsonb_build_object('ok', true, 'paymentStatus', v_payment.status, 'noop', true);
  end if;
  if v_payment.status not in ('pending', 'created') then
    raise exception 'PAYMENT_INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = v_payment.booking_id for update;

  -- Resultado 2: comprobante aprobado por la IA.
  if p_result = 2 then
    if p_mode = 'auto' then
      -- Modo A: confirma la reserva reutilizando la lógica transaccional existente
      -- (valida monto, hold y estado; ante mismatch manda a manual_review).
      return public.confirm_booking_payment(p_payment_id);
    end if;

    -- Modo B: la IA aprueba, un humano confirma. La reserva no se toca todavía.
    update public.payments
      set status = 'ai_approved', expires_at = v_hold_extension
      where id = p_payment_id;
    update public.booking_holds
      set expires_at = v_hold_extension
      where booking_id = v_booking.id and status = 'active';
    insert into public.payment_events (payment_id, booking_id, source, event_type, old_status, new_status, metadata)
    values (p_payment_id, v_booking.id, 'manual_verify', 'receipt_ai_approved', v_payment.status, 'ai_approved', v_meta);
    return jsonb_build_object('ok', true, 'paymentStatus', 'ai_approved', 'bookingStatus', v_booking.status);
  end if;

  -- Resultado 1: no se pudo confirmar. Sin cambio de estado (permite reintento).
  if p_result = 1 then
    insert into public.payment_events (payment_id, booking_id, source, event_type, old_status, new_status, metadata)
    values (p_payment_id, v_booking.id, 'manual_verify', 'receipt_insufficient', v_payment.status, v_payment.status, v_meta);
    return jsonb_build_object('ok', true, 'paymentStatus', v_payment.status, 'retry', true);
  end if;

  -- Resultado 3 (fuera de plazo) / 4 (error) / IA no disponible → revisión manual.
  update public.payments
    set status = 'manual_review', expires_at = v_hold_extension
    where id = p_payment_id;
  update public.bookings
    set status = 'manual_review', payment_status = 'failed'
    where id = v_booking.id;
  update public.booking_holds
    set expires_at = v_hold_extension
    where booking_id = v_booking.id and status = 'active';
  insert into public.payment_events (payment_id, booking_id, source, event_type, old_status, new_status, metadata)
  values (
    p_payment_id, v_booking.id, 'manual_verify',
    case when p_result = 3 then 'receipt_out_of_window' else 'receipt_manual_review' end,
    v_payment.status, 'manual_review', v_meta
  );
  return jsonb_build_object('ok', true, 'paymentStatus', 'manual_review', 'bookingStatus', 'manual_review');
end;
$$;

-- Modo B: un humano confirma un pago que la IA dejó en 'ai_approved'. Cierra el
-- ciclo igual que confirm_booking_payment (paid/confirmed + hold convertido).
create or replace function public.admin_confirm_ai_payment(
  p_payment_id uuid,
  p_actor_id uuid
)
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
    return jsonb_build_object('ok', true, 'paymentStatus', 'paid', 'bookingStatus', 'confirmed');
  end if;
  if v_payment.status <> 'ai_approved' then
    raise exception 'PAYMENT_INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = v_payment.booking_id for update;

  update public.payments set status = 'paid', paid_at = now() where id = p_payment_id;
  update public.bookings set status = 'confirmed', confirmed_at = now(), payment_status = 'paid'
    where id = v_booking.id;

  select * into v_hold from public.booking_holds
    where booking_id = v_booking.id and status = 'active'
    order by created_at desc limit 1;
  if found then
    update public.booking_holds set status = 'converted' where id = v_hold.id;
  end if;

  insert into public.payment_events (payment_id, booking_id, source, event_type, old_status, new_status, metadata)
  values (p_payment_id, v_booking.id, 'admin', 'payment_confirmed', 'ai_approved', 'paid', jsonb_build_object('actorId', p_actor_id));

  return jsonb_build_object('ok', true, 'paymentStatus', 'paid', 'bookingStatus', 'confirmed', 'paidAt', now());
end;
$$;

-- Un humano rechaza un pago (comprobante inválido o revisión negativa). Marca el
-- pago 'error', libera el hold y expira la reserva (fechas disponibles de nuevo).
create or replace function public.admin_reject_payment(
  p_payment_id uuid,
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
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_payment.status in ('paid', 'refunded') then
    raise exception 'PAYMENT_INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = v_payment.booking_id for update;

  update public.payments set status = 'error', failed_at = now() where id = p_payment_id;
  update public.bookings set status = 'expired', payment_status = 'failed' where id = v_booking.id;
  update public.booking_holds set status = 'expired', released_at = now()
    where booking_id = v_booking.id and status = 'active';

  insert into public.payment_events (payment_id, booking_id, source, event_type, old_status, new_status, metadata, error_message)
  values (p_payment_id, v_booking.id, 'admin', 'payment_rejected', v_payment.status, 'error',
    jsonb_build_object('actorId', p_actor_id), p_reason);

  return jsonb_build_object('ok', true, 'paymentStatus', 'error', 'bookingStatus', 'expired');
end;
$$;

-- Permisos: solo service_role (orquestación server-side). Nunca anon/authenticated.
revoke all on function public.apply_receipt_result(uuid, uuid, smallint, text) from public;
grant execute on function public.apply_receipt_result(uuid, uuid, smallint, text) to service_role;

revoke all on function public.admin_confirm_ai_payment(uuid, uuid) from public;
grant execute on function public.admin_confirm_ai_payment(uuid, uuid) to service_role;

revoke all on function public.admin_reject_payment(uuid, uuid, text) from public;
grant execute on function public.admin_reject_payment(uuid, uuid, text) to service_role;
