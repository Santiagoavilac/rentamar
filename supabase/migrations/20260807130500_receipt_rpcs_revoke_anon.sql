-- Las funciones de orquestación de pagos son server-side (service_role). El proyecto
-- tiene default privileges que otorgan execute a anon/authenticated al crear funciones,
-- así que `revoke from public` no alcanza: hay que revocar de esos roles explícitamente.
revoke all on function public.apply_receipt_result(uuid, uuid, smallint, text) from anon, authenticated;
revoke all on function public.admin_confirm_ai_payment(uuid, uuid) from anon, authenticated;
revoke all on function public.admin_reject_payment(uuid, uuid, text) from anon, authenticated;
