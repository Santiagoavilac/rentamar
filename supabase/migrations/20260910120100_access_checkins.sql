-- Registro de ingreso, huésped por huésped.
--
-- `access_approvals` responde "¿RentaMar dejó entrar a este grupo?": es un permiso, uno por
-- reserva o estadía. Lo que faltaba es el hecho físico: quién se presentó en el mostrador,
-- a qué hora y si ya retiró su manilla. Son cosas distintas — un grupo aprobado puede
-- llegar en tandas — así que va en su propia tabla, con una fila por persona.
--
-- SIN FILA = ROJO (no se presentó). CON FILA = VERDE (registrado), con su hora.

create table public.access_checkins (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete cascade,
  stay_id uuid references public.co_owner_stays (id) on delete cascade,
  -- El titular no tiene fila propia en booking_companions ni en co_owner_stay_guests:
  -- su person_ref es null. Los acompañantes apuntan a su fila. Sin FK porque son dos
  -- tablas distintas; el borrado en cascada del registro ya limpia esto.
  person_kind text not null check (person_kind in ('titular', 'acompanante')),
  person_ref uuid,
  -- Copia congelada: el papel firmado dice este nombre aunque después lo corrijan.
  person_name text not null,
  person_document_id text,
  wristband_delivered boolean not null default false,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint access_checkins_target_check check (num_nonnulls(booking_id, stay_id) = 1),
  constraint access_checkins_person_ref_check check (
    (person_kind = 'titular' and person_ref is null)
    or (person_kind = 'acompanante' and person_ref is not null)
  )
);

-- Una sola fila por persona. El uuid nulo representa al titular dentro del índice.
create unique index access_checkins_booking_person_idx
  on public.access_checkins (booking_id, coalesce(person_ref, '00000000-0000-0000-0000-000000000000'::uuid))
  where booking_id is not null;
create unique index access_checkins_stay_person_idx
  on public.access_checkins (stay_id, coalesce(person_ref, '00000000-0000-0000-0000-000000000000'::uuid))
  where stay_id is not null;

-- La pantalla de ingresos del día ordena y filtra por esta columna.
create index access_checkins_checked_in_at_idx on public.access_checkins (checked_in_at desc);

-- ---------- RLS ----------
-- Solo lectura y solo staff, igual que access_approvals. El guardia no lee esta tabla:
-- lo que necesita saber le llega por list_access_entries. Toda escritura pasa por las RPC.

alter table public.access_checkins enable row level security;

create policy access_checkins_staff_read on public.access_checkins
  for select using (public.is_staff());

-- ---------- Registrar el ingreso de una persona ----------

create or replace function public.check_in_person(
  p_booking_id uuid,
  p_stay_id uuid,
  p_person_kind text,
  p_person_ref uuid,
  p_person_name text,
  p_person_document_id text,
  p_wristband boolean,
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
  v_checked_in_at timestamptz;
  v_name text := nullif(btrim(coalesce(p_person_name, '')), '');
begin
  if num_nonnulls(p_booking_id, p_stay_id) <> 1 then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  if p_person_kind not in ('titular', 'acompanante') then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  if (p_person_kind = 'titular') <> (p_person_ref is null) then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  if v_name is null then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;

  -- El registro tiene que existir. El lock evita que se borre entre el chequeo y el insert.
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

  -- Nadie entra sin permiso: el ingreso físico presupone que la oficina ya aprobó al grupo.
  if not exists (
    select 1 from public.access_approvals a
    where (p_booking_id is not null and a.booking_id = p_booking_id)
       or (p_stay_id is not null and a.stay_id = p_stay_id)
  ) then
    raise exception 'ACCESS_NOT_APPROVED' using errcode = 'P0001';
  end if;

  -- Volver a marcar a la misma persona actualiza la manilla sin mover la hora original:
  -- la hora del registro es un hecho, no se reescribe por corregir una casilla. Se lee
  -- antes de borrar, porque después la fila ya no está.
  select c.checked_in_at into v_checked_in_at
  from public.access_checkins c
  where (p_booking_id is not null and c.booking_id = p_booking_id
         or p_stay_id is not null and c.stay_id = p_stay_id)
    and c.person_ref is not distinct from p_person_ref;

  delete from public.access_checkins c
  where (p_booking_id is not null and c.booking_id = p_booking_id
         or p_stay_id is not null and c.stay_id = p_stay_id)
    and c.person_ref is not distinct from p_person_ref;

  insert into public.access_checkins (
    booking_id, stay_id, person_kind, person_ref, person_name, person_document_id,
    wristband_delivered, checked_in_by, checked_in_at
  ) values (
    p_booking_id, p_stay_id, p_person_kind, p_person_ref, v_name,
    nullif(btrim(coalesce(p_person_document_id, '')), ''),
    coalesce(p_wristband, false), p_actor_id,
    coalesce(v_checked_in_at, now())
  )
  returning id into v_id;

  return jsonb_build_object('checkinId', v_id);
end;
$$;

-- ---------- Deshacer ----------
-- Marcar al huésped equivocado tiene que ser reversible.

create or replace function public.undo_check_in(
  p_booking_id uuid,
  p_stay_id uuid,
  p_person_ref uuid
)
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

  delete from public.access_checkins c
  where (p_booking_id is not null and c.booking_id = p_booking_id
         or p_stay_id is not null and c.stay_id = p_stay_id)
    and c.person_ref is not distinct from p_person_ref;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('deleted', v_deleted);
end;
$$;

-- ---------- Ingresos del día (pantalla de administración) ----------
-- Una fila por registro, no por persona: la administración quiere ver "quién acaba de
-- entrar al complejo", y eso es el grupo. La hora es la del primer huésped que se presentó.
--
-- Va aparte de list_access_entries a propósito: ésta devuelve el teléfono, y esa función
-- se la comparte con el guardia, que no tiene por qué verlo.

create or replace function public.list_office_checkins(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  source text,
  entry_id uuid,
  checked_in_at timestamptz,
  titular text,
  phone text,
  check_out date,
  lugar text,
  people_checked_in int,
  guest_count int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  with por_registro as (
    select
      c.booking_id as f_booking_id,
      c.stay_id as f_stay_id,
      min(c.checked_in_at) as f_checked_in_at,
      count(*)::int as f_people
    from public.access_checkins c
    where (p_from is null or c.checked_in_at >= p_from)
      and (p_to is null or c.checked_in_at <= p_to)
    group by c.booking_id, c.stay_id
  )
  select
    case
      when r.f_stay_id is not null then 'copropietario'
      when b.channel = 'affiliate' then 'afiliado'
      else 'alquiler'
    end,
    coalesce(r.f_booking_id, r.f_stay_id),
    r.f_checked_in_at,
    coalesce(b.guest_name, s.full_name),
    coalesce(b.guest_phone, s.phone),
    coalesce(b.check_out, (s.check_out_at at time zone 'America/La_Paz')::date),
    coalesce(p.name, s.property_name),
    r.f_people,
    coalesce(b.guests, s.adults + s.minors)
  from por_registro r
  left join public.bookings b on b.id = r.f_booking_id
  left join public.properties p on p.id = b.property_id
  left join public.co_owner_stays s on s.id = r.f_stay_id
  -- El más reciente arriba: es el que acaba de pasar por el mostrador.
  order by r.f_checked_in_at desc;
end;
$$;

-- ---------- Permisos ----------
-- Registrar y deshacer son del panel: pasan por assertAdminAction y se llaman con
-- service_role, igual que approve_access. El listado de ingresos también es del panel.

revoke all on function public.check_in_person(uuid, uuid, text, uuid, text, text, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.check_in_person(uuid, uuid, text, uuid, text, text, boolean, uuid)
  to service_role;

revoke all on function public.undo_check_in(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.undo_check_in(uuid, uuid, uuid) to service_role;

revoke all on function public.list_office_checkins(timestamptz, timestamptz) from public, anon;
grant execute on function public.list_office_checkins(timestamptz, timestamptz)
  to authenticated, service_role;

-- ---------- El guardia también ve quién ya se registró ----------
-- Se reemplaza list_access_entries para sumar el estado por persona. Sigue sin devolver
-- teléfonos, correos, montos ni tokens: lo único que se agrega es el booleano de registro
-- y el de manilla, que es justamente lo que el guardia necesita para dejar pasar.

-- Cambia el tipo de retorno (suma dos columnas), y eso `create or replace` no lo permite:
-- hay que dropear primero. Nada más la referencia por nombre, así que no hay dependencias.
drop function if exists public.list_access_entries(date, text);

create function public.list_access_entries(
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
  people jsonb,
  titular_checked_in boolean,
  checked_in_count int
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
            jsonb_build_object(
              'nombre', c.full_name,
              'carnet', c.document_id,
              'registrado', k.id is not null,
              'manilla', coalesce(k.wristband_delivered, false)
            )
            order by c.sort_order, c.full_name
          ),
          '[]'::jsonb
        )
        from public.booking_companions c
        left join public.access_checkins k
          on k.booking_id = b.id and k.person_ref = c.id
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
            jsonb_build_object(
              'nombre', g.full_name,
              'carnet', g.document_id,
              'registrado', k.id is not null,
              'manilla', coalesce(k.wristband_delivered, false)
            )
            order by g.sort_order, g.full_name
          ),
          '[]'::jsonb
        )
        from public.co_owner_stay_guests g
        left join public.access_checkins k
          on k.stay_id = s.id and k.person_ref = g.id
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
    t.f_people,
    (titular_k.id is not null),
    coalesce(conteo.total, 0)::int
  from todos t
  left join public.access_approvals a
    on (t.f_source = 'copropietario' and a.stay_id = t.f_entry_id)
    or (t.f_source <> 'copropietario' and a.booking_id = t.f_entry_id)
  left join public.access_checkins titular_k
    on titular_k.person_ref is null
   and ((t.f_source = 'copropietario' and titular_k.stay_id = t.f_entry_id)
     or (t.f_source <> 'copropietario' and titular_k.booking_id = t.f_entry_id))
  left join lateral (
    select count(*) as total
    from public.access_checkins k
    where (t.f_source = 'copropietario' and k.stay_id = t.f_entry_id)
       or (t.f_source <> 'copropietario' and k.booking_id = t.f_entry_id)
  ) conteo on true
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

revoke all on function public.list_access_entries(date, text) from public, anon;
grant execute on function public.list_access_entries(date, text) to authenticated, service_role;
