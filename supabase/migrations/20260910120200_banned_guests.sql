-- Huéspedes vetados.
--
-- Administración mantiene una lista de personas que no pueden ingresar al complejo. Si
-- alguien intenta registrarlas —da igual el canal: RentaMar, afiliado o copropietario— el
-- alta tiene que fallar, no solo mostrar un cartel.
--
-- Por eso el bloqueo vive en la base y no en el formulario: los tres canales entran por
-- RPCs distintas y dos de ellas son públicas. Validar solo en el front sería decorativo.
--
-- Y va por trigger en vez de dentro de cada RPC: `create_booking_with_hold`,
-- `create_affiliate_booking_request` y `register_co_owner_stay` son funciones grandes y en
-- producción; recrearlas es más riesgoso que un trigger acotado, que además cubre cualquier
-- camino futuro sin que nadie tenga que acordarse de agregar la llamada.

-- ---------- Normalización del documento ----------
-- `1234567-1B`, `1234567 1b` y `1.234.567 1B` son la misma persona. Sin esto, vetar a
-- alguien se esquiva escribiendo el carnet distinto.

-- Sin cláusula SET: la usa una columna generada, que exige una expresión inmutable, y
-- todo lo que invoca (upper, regexp_replace, nullif) vive en pg_catalog, que siempre se
-- busca primero. Tampoco es SECURITY DEFINER, así que no hay search_path que fijar.
create or replace function public.normalize_document(p_document text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(p_document, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

-- ---------- La lista ----------

create table public.banned_guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) >= 2),
  document_id text not null check (length(btrim(document_id)) >= 4),
  document_normalized text generated always as (public.normalize_document(document_id)) stored,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  -- No se borra: hay que poder auditar quién vetó a quién y desde cuándo.
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id),
  constraint banned_guests_revocation_check check (
    (revoked_at is null and revoked_by is null)
    or (revoked_at is not null and revoked_by is not null)
  )
);

-- Un documento vetado a la vez. Los revocados no molestan: pueden repetirse en el histórico.
create unique index banned_guests_document_active_idx
  on public.banned_guests (document_normalized)
  where revoked_at is null;

create index banned_guests_created_at_idx on public.banned_guests (created_at desc);

-- ---------- Intentos bloqueados ----------
-- El "avisar al admin". Lo escribe la aplicación cuando atrapa GUEST_BANNED, no el trigger:
-- la excepción hace rollback de su propia transacción, así que una fila insertada ahí
-- adentro se perdería. Queda fuera del camino crítico a propósito — si el registro del
-- intento falla, el bloqueo ya ocurrió igual.

create table public.banned_guest_attempts (
  id uuid primary key default gen_random_uuid(),
  -- 'alquiler' | 'afiliado' | 'copropietario'
  channel text not null,
  -- Lo que la persona tipeó, tal cual: [{ "nombre": ..., "carnet": ... }]
  submitted jsonb not null default '[]'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index banned_guest_attempts_created_at_idx
  on public.banned_guest_attempts (created_at desc);

-- ---------- El bloqueo ----------

create or replace function public.assert_not_banned(p_document text, p_name text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_document text := public.normalize_document(p_document);
begin
  -- Sin carnet no hay a quién comparar. No es una puerta abierta: las tablas ya exigen el
  -- documento donde importa, y el nombre solo no alcanza para vetar a alguien.
  if v_document is null then
    return;
  end if;

  if exists (
    select 1 from public.banned_guests b
    where b.document_normalized = v_document and b.revoked_at is null
  ) then
    raise exception 'GUEST_BANNED' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------- Triggers ----------
-- Uno por cada tabla donde entra una persona.

create or replace function public.tg_assert_booking_not_banned()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- El canal directo carga el carnet en un update posterior a la RPC, así que el trigger
  -- corre también en UPDATE. El afiliado sí lo trae desde el insert.
  perform public.assert_not_banned(new.guest_document_id, new.guest_name);
  perform public.assert_not_banned(new.affiliate_document_id, new.guest_name);
  return new;
end;
$$;

create trigger bookings_assert_not_banned
  before insert or update of guest_document_id, affiliate_document_id
  on public.bookings
  for each row execute function public.tg_assert_booking_not_banned();

create or replace function public.tg_assert_companion_not_banned()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_not_banned(new.document_id, new.full_name);
  return new;
end;
$$;

create trigger booking_companions_assert_not_banned
  before insert or update of document_id on public.booking_companions
  for each row execute function public.tg_assert_companion_not_banned();

create trigger co_owner_stay_guests_assert_not_banned
  before insert or update of document_id on public.co_owner_stay_guests
  for each row execute function public.tg_assert_companion_not_banned();

create or replace function public.tg_assert_stay_not_banned()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_not_banned(new.document_id, new.full_name);
  return new;
end;
$$;

create trigger co_owner_stays_assert_not_banned
  before insert or update of document_id on public.co_owner_stays
  for each row execute function public.tg_assert_stay_not_banned();

-- Si a alguien lo vetaron después de reservar, la oficina tampoco puede aprobarle el
-- ingreso. Es el último punto donde el sistema puede frenarlo antes de la manilla.
create or replace function public.tg_assert_approval_not_banned()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
begin
  if new.booking_id is not null then
    select b.guest_name, coalesce(b.guest_document_id, b.affiliate_document_id) as doc
      into v_row from public.bookings b where b.id = new.booking_id;
  else
    select s.full_name as guest_name, s.document_id as doc
      into v_row from public.co_owner_stays s where s.id = new.stay_id;
  end if;
  if found then
    perform public.assert_not_banned(v_row.doc, v_row.guest_name);
  end if;
  return new;
end;
$$;

create trigger access_approvals_assert_not_banned
  before insert on public.access_approvals
  for each row execute function public.tg_assert_approval_not_banned();

-- ---------- RLS ----------
-- Solo staff lee. Escribe el panel con service_role, igual que el resto. El público jamás
-- ve la lista: saber quién está vetado no es asunto suyo.

alter table public.banned_guests enable row level security;
alter table public.banned_guest_attempts enable row level security;

create policy banned_guests_staff_read on public.banned_guests
  for select using (public.is_staff());

create policy banned_guest_attempts_staff_read on public.banned_guest_attempts
  for select using (public.is_staff());

-- ---------- Permisos ----------
-- assert_not_banned y normalize_document las invocan los triggers, que corren como definer.
-- Exponerlas a anon las volvería un oráculo para averiguar quién está en la lista.

revoke all on function public.assert_not_banned(text, text) from public, anon, authenticated;
revoke all on function public.normalize_document(text) from public, anon, authenticated;
grant execute on function public.normalize_document(text) to service_role;

revoke all on function public.tg_assert_booking_not_banned() from public, anon, authenticated;
revoke all on function public.tg_assert_companion_not_banned() from public, anon, authenticated;
revoke all on function public.tg_assert_stay_not_banned() from public, anon, authenticated;
revoke all on function public.tg_assert_approval_not_banned() from public, anon, authenticated;
