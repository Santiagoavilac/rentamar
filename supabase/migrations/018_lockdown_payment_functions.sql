-- Fase 2 — Blindaje. Los grants por default de Supabase otorgan EXECUTE a
-- anon/authenticated sobre funciones nuevas en public; `revoke from public` no los
-- quita. Se revoca explícitamente para dejar los RPC de pago solo a service_role
-- (orquestación server-side). Mismo patrón que 010 para expire_stale_holds.

revoke execute on function
  public.create_payment_intent(uuid, public.payment_provider, text, public.payment_method, text, timestamptz)
  from anon, authenticated;

revoke execute on function
  public.attach_payment_provider_data(uuid, text, text, text, text, text, jsonb)
  from anon, authenticated;

revoke execute on function
  public.confirm_booking_payment(uuid)
  from anon, authenticated;

revoke execute on function
  public.record_payment_error(uuid, text, jsonb)
  from anon, authenticated;

revoke execute on function
  public.expire_payment(uuid)
  from anon, authenticated;

revoke execute on function
  public.expire_stale_payments()
  from anon, authenticated;
