-- Teléfono de contacto y límite de huéspedes por cuenta de copropietario.
-- El límite cuenta ACOMPAÑANTES: el titular firma la declaración y no ocupa cupo.

-- phone queda nullable: ya hay cuentas creadas sin teléfono. El formulario de alta lo
-- exige de acá en adelante y las viejas se completan desde el panel.
alter table public.co_owner_accounts
  add column if not exists phone text,
  add column if not exists max_guests int not null default 20;

alter table public.co_owner_accounts
  drop constraint if exists co_owner_accounts_max_guests_check;

alter table public.co_owner_accounts
  add constraint co_owner_accounts_max_guests_check check (max_guests between 1 and 50);

-- La RPC es security definer y ejecutable por cualquier authenticated, así que el límite
-- se revalida acá: sin esto, un POST manipulado declara los huéspedes que quiera.
create or replace function public.register_co_owner_stay(
  p_full_name text,
  p_document_id text,
  p_phone text,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
  p_adults int,
  p_minors int
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_id uuid;
  v_username text;
  v_property_name text;
  v_room_count int;
  v_max_guests int;
  v_stay_id uuid;
begin
  select a.id, a.username, a.property_name, a.room_count, a.max_guests
    into v_account_id, v_username, v_property_name, v_room_count, v_max_guests
  from public.co_owner_accounts a
  where a.id = auth.uid() and a.is_active;
  if not found then
    raise exception 'CO_OWNER_INACTIVE' using errcode = 'P0001';
  end if;

  if p_check_out_at is null or p_check_in_at is null or p_check_out_at <= p_check_in_at then
    raise exception 'INVALID_STAY_RANGE' using errcode = 'P0001';
  end if;

  if coalesce(p_adults, 0) < 1 or coalesce(p_minors, 0) < 0 then
    raise exception 'INVALID_GUEST_COUNT' using errcode = 'P0001';
  end if;

  -- p_adults = titular + acompañantes, así que el cupo se mide sobre p_adults - 1.
  if p_adults - 1 > v_max_guests then
    raise exception 'GUEST_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p_full_name, ''))) = 0
     or length(btrim(coalesce(p_document_id, ''))) = 0
     or length(btrim(coalesce(p_phone, ''))) = 0 then
    raise exception 'MISSING_GUEST_DATA' using errcode = 'P0001';
  end if;

  insert into public.co_owner_stays (
    account_id, username, property_name, room_count,
    full_name, document_id, phone, check_in_at, check_out_at, adults, minors
  ) values (
    v_account_id, v_username, v_property_name, v_room_count,
    btrim(p_full_name), btrim(p_document_id), btrim(p_phone),
    p_check_in_at, p_check_out_at, p_adults, coalesce(p_minors, 0)
  )
  returning id into v_stay_id;

  return jsonb_build_object('stayId', v_stay_id);
end;
$$;

revoke all on function public.register_co_owner_stay(
  text, text, text, timestamptz, timestamptz, int, int
) from public;
grant execute on function public.register_co_owner_stay(
  text, text, text, timestamptz, timestamptz, int, int
) to authenticated, service_role;
