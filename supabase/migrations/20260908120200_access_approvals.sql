-- Control de acceso: RentaMar aprueba, el guardia consulta.
--
-- Nadie entra sin pasar antes por la oficina: firmar la declaración jurada, dejar la
-- garantía y recibir las manillas. Esta tabla es la constancia de ese paso.
--
-- Espeja a `declarations`: una fila apunta a una reserva (canal directo o afiliado) o a una
-- estadía de copropietario, nunca a las dos. No se toca `bookings`, `co_owner_stays` ni
-- ninguna RPC existente, así que ningún flujo de alta cambia.
--
-- SIN FILA = ROJO (no puede entrar). CON FILA = VERDE (aprobado).

create table public.access_approvals (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete cascade,
  stay_id uuid references public.co_owner_stays (id) on delete cascade,
  declaration_signed boolean not null default false,
  deposit_received boolean not null default false,
  wristbands_delivered boolean not null default false,
  notes text,
  approved_at timestamptz not null default now(),
  approved_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  -- Apunta exactamente a una reserva o a una estadía, nunca a las dos ni a ninguna.
  constraint access_approvals_target_check check (num_nonnulls(booking_id, stay_id) = 1)
);

-- Una sola aprobación vigente por reserva o estadía.
create unique index access_approvals_booking_idx
  on public.access_approvals (booking_id) where booking_id is not null;
create unique index access_approvals_stay_idx
  on public.access_approvals (stay_id) where stay_id is not null;

-- ---------- RLS ----------
-- Solo lectura y solo staff. El guardia NO lee esta tabla: lee list_access_entries, que le
-- devuelve el booleano y nada más. Toda escritura pasa por las RPC de abajo.

alter table public.access_approvals enable row level security;

create policy access_approvals_staff_read on public.access_approvals
  for select using (public.is_staff());

-- ---------- Aprobar ----------
-- Se borra y se vuelve a insertar en vez de hacer upsert: los índices únicos son parciales
-- y la última aprobación es la que vale, con su fecha y su responsable.

create or replace function public.approve_access(
  p_booking_id uuid,
  p_stay_id uuid,
  p_declaration boolean,
  p_deposit boolean,
  p_wristbands boolean,
  p_notes text,
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
  if num_nonnulls(p_booking_id, p_stay_id) <> 1 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  if p_booking_id is not null then
    perform 1 from public.bookings where id = p_booking_id for update;
    if not found then
      raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
    end if;
  else
    perform 1 from public.co_owner_stays where id = p_stay_id for update;
    if not found then
      raise exception 'STAY_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  delete from public.access_approvals a
  where (p_booking_id is not null and a.booking_id = p_booking_id)
     or (p_stay_id is not null and a.stay_id = p_stay_id);

  insert into public.access_approvals (
    booking_id, stay_id, declaration_signed, deposit_received, wristbands_delivered,
    notes, approved_by
  ) values (
    p_booking_id, p_stay_id, coalesce(p_declaration, false), coalesce(p_deposit, false),
    coalesce(p_wristbands, false), nullif(btrim(coalesce(p_notes, '')), ''), p_actor_id
  )
  returning id into v_id;

  return jsonb_build_object('approvalId', v_id);
end;
$$;

-- ---------- Quitar la aprobación ----------

create or replace function public.revoke_access(p_booking_id uuid, p_stay_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
begin
  if num_nonnulls(p_booking_id, p_stay_id) <> 1 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  delete from public.access_approvals a
  where (p_booking_id is not null and a.booking_id = p_booking_id)
     or (p_stay_id is not null and a.stay_id = p_stay_id);
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('deleted', v_deleted);
end;
$$;

-- ---------- Listado unificado ----------
-- Lo único que ve el guardia. Junta los tres orígenes (alquiler directo, afiliado y
-- copropietario) y devuelve solo lo necesario para dejar pasar a alguien: quién es, dónde
-- va, qué días y si está aprobado. Nunca montos, correos, teléfonos ni tokens.

create or replace function public.list_access_entries(
  p_date date default null,
  p_search text default null
)
returns table (
  source text,
  entry_id uuid,
  titular text,
  document_id text,
  lugar text,
  check_in date,
  check_out date,
  guest_count int,
  approved boolean,
  approved_at timestamptz,
  people jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_date date := p_date;
begin
  if not (public.is_guard() or public.is_staff()) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- Buscar por nombre o carnet manda sobre la fecha: el guardia escribe el nombre y espera
  -- encontrarlo aunque la estadía empiece mañana.
  if v_search is not null then
    v_date := null;
  end if;

  return query
  with reservas as (
    select
      case when b.channel = 'affiliate' then 'afiliado' else 'alquiler' end as f_source,
      b.id as f_entry_id,
      b.guest_name as f_titular,
      coalesce(b.guest_document_id, b.affiliate_document_id) as f_document_id,
      p.name as f_lugar,
      b.check_in as f_check_in,
      b.check_out as f_check_out,
      b.guests as f_guest_count,
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object('nombre', c.full_name, 'carnet', c.document_id)
            order by c.sort_order, c.full_name
          ),
          '[]'::jsonb
        )
        from public.booking_companions c
        where c.booking_id = b.id
      ) as f_people
    from public.bookings b
    join public.properties p on p.id = b.property_id
    where b.status not in ('cancelled', 'expired', 'draft')
  ),
  estadias as (
    select
      'copropietario' as f_source,
      s.id as f_entry_id,
      s.full_name as f_titular,
      s.document_id as f_document_id,
      s.property_name as f_lugar,
      (s.check_in_at at time zone 'America/La_Paz')::date as f_check_in,
      (s.check_out_at at time zone 'America/La_Paz')::date as f_check_out,
      (s.adults + s.minors) as f_guest_count,
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object('nombre', g.full_name, 'carnet', g.document_id)
            order by g.sort_order, g.full_name
          ),
          '[]'::jsonb
        )
        from public.co_owner_stay_guests g
        where g.stay_id = s.id
      ) as f_people
    from public.co_owner_stays s
  ),
  todos as (
    select * from reservas
    union all
    select * from estadias
  )
  select
    t.f_source,
    t.f_entry_id,
    t.f_titular,
    t.f_document_id,
    t.f_lugar,
    t.f_check_in,
    t.f_check_out,
    t.f_guest_count,
    (a.id is not null),
    a.approved_at,
    t.f_people
  from todos t
  left join public.access_approvals a
    on (t.f_source = 'copropietario' and a.stay_id = t.f_entry_id)
    or (t.f_source <> 'copropietario' and a.booking_id = t.f_entry_id)
  -- Sigue apareciendo el día de salida: esa mañana la gente todavía está adentro.
  where (v_date is null or (t.f_check_in <= v_date and t.f_check_out >= v_date))
    and (
      v_search is null
      or t.f_titular ilike '%' || v_search || '%'
      or coalesce(t.f_document_id, '') ilike '%' || v_search || '%'
      or exists (
        select 1
        from jsonb_array_elements(t.f_people) e
        where (e ->> 'nombre') ilike '%' || v_search || '%'
           or (e ->> 'carnet') ilike '%' || v_search || '%'
      )
    )
  -- Los no aprobados primero: son los que necesitan que alguien haga algo.
  order by (a.id is not null) asc, t.f_check_in asc, t.f_titular asc;
end;
$$;

-- ---------- Permisos ----------
-- Aprobar y desaprobar son del panel: pasan por assertAdminAction y se llaman con
-- service_role, igual que set_booking_companions. El listado sí lo llama el guardia con su
-- propia sesión, y su guarda interna decide.

revoke all on function public.approve_access(uuid, uuid, boolean, boolean, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function public.approve_access(uuid, uuid, boolean, boolean, boolean, text, uuid)
  to service_role;

revoke all on function public.revoke_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_access(uuid, uuid) to service_role;

revoke all on function public.list_access_entries(date, text) from public, anon;
grant execute on function public.list_access_entries(date, text) to authenticated, service_role;
