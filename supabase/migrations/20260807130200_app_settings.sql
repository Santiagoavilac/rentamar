-- Configuración de aplicación editable en runtime (sin redeploy). Hoy solo guarda el
-- modo de confirmación de comprobantes:
--   "admin" (Modo B, default): la IA aprueba y un humano confirma la reserva.
--   "auto"  (Modo A): un comprobante aprobado por IA confirma la reserva automáticamente.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('receipt_confirm_mode', '"admin"'::jsonb)
on conflict (key) do nothing;

-- Lectura solo staff; la escritura pasa por service_role desde el servidor.
alter table public.app_settings enable row level security;

create policy app_settings_staff_read on public.app_settings
  for select using (public.is_staff());
