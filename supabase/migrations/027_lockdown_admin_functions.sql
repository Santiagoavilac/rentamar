-- Fase 3 — Lockdown de las RPC administrativas (igual que 018 para pagos).
-- Supabase concede EXECUTE por defecto a anon/authenticated en funciones nuevas del
-- schema public; revocar solo de public no alcanza. Estas RPC solo las ejecuta el
-- servidor (service_role); la autorización de rol se hace en la app.
-- NO se tocan: create_booking_with_hold, calculate_booking_price,
-- get_property_availability, is_admin, is_staff (superficie pública intencional).

revoke execute on function public.create_availability_block(uuid, date, date, public.availability_block_type, text, uuid) from anon, authenticated;
revoke execute on function public.release_availability_block(uuid, text, uuid) from anon, authenticated;
revoke execute on function public.cancel_booking(uuid, text, uuid, public.booking_event_source) from anon, authenticated;
revoke execute on function public.expire_booking_admin(uuid, text, uuid, public.booking_event_source) from anon, authenticated;
revoke execute on function public.mark_booking_manual_review(uuid, text, uuid, public.booking_event_source) from anon, authenticated;
revoke execute on function public.confirm_booking_manual(uuid, text, uuid, public.booking_event_source) from anon, authenticated;
revoke execute on function public.change_property_base_price(uuid, bigint, text, uuid) from anon, authenticated;
revoke execute on function public.create_property_rate(uuid, date, date, bigint, int, text, uuid, text) from anon, authenticated;
revoke execute on function public.update_property_rate(uuid, date, date, bigint, int, text, uuid, text) from anon, authenticated;
revoke execute on function public.remove_property_rate(uuid, uuid, text) from anon, authenticated;
revoke execute on function public.change_user_role(uuid, public.user_role, text, uuid) from anon, authenticated;

-- Storage: el bucket es público (las imágenes se sirven por URL pública sin RLS).
-- La policy amplia de SELECT solo habilitaba el listado del bucket; se elimina para
-- no exponer el índice de objetos. El acceso por URL pública sigue funcionando.
drop policy if exists "property_images_public_read" on storage.objects;
