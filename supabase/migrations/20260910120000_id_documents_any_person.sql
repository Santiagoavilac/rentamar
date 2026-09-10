-- Fotos de carnet para cualquier registro y cualquier persona.
--
-- Hasta ahora `id_documents` guardaba solo el carnet del titular de una reserva de
-- afiliado, que sube el propio afiliado desde el formulario público. La oficina necesita
-- además cargar a mano la foto del documento de:
--   * el titular y los acompañantes de una reserva (huéspedes RentaMar y afiliados), y
--   * el titular y los huéspedes adicionales de una estadía de copropietario.
--
-- Se extiende la tabla existente en vez de crear una paralela: el carnet de una persona
-- tiene que estar en un solo lugar, se haya subido desde el formulario público o desde el
-- panel. El bucket `id-documents` ya existe, ya es privado y no se toca.

-- ---------- Objetivo: reserva O estadía ----------
-- Mismo molde que `declarations` y `access_approvals`.

alter table public.id_documents
  add column stay_id uuid references public.co_owner_stays (id) on delete cascade;

alter table public.id_documents
  alter column booking_id drop not null;

alter table public.id_documents
  add constraint id_documents_target_check check (num_nonnulls(booking_id, stay_id) = 1);

-- ---------- Persona dentro del registro ----------
-- `person_ref` apunta a `booking_companions.id` o a `co_owner_stay_guests.id`. No lleva FK
-- porque son dos tablas distintas; el borrado en cascada del registro ya limpia la fila.
-- `person_name` queda congelado para que la foto siga siendo identificable si más tarde
-- se corrige o se borra al acompañante.

alter table public.id_documents
  add column person_kind text not null default 'titular'
    check (person_kind in ('titular', 'acompanante')),
  add column person_ref uuid,
  add column person_name text;

-- El titular no tiene fila propia en ninguna tabla de acompañantes: su person_ref es null.
alter table public.id_documents
  add constraint id_documents_person_ref_check check (
    (person_kind = 'titular' and person_ref is null)
    or (person_kind = 'acompanante' and person_ref is not null)
  );

-- ---------- Unicidad ----------
-- La constraint vieja `unique (booking_id, side)` permitía un solo anverso por reserva,
-- lo que ahora sería un anverso para todo el grupo. Se reemplaza por "un anverso y un
-- reverso por persona". Las filas que existen hoy son todas del titular (person_ref null),
-- así que el uuid nulo las mantiene distinguibles dentro del índice.

alter table public.id_documents drop constraint id_documents_unique_side;

create unique index id_documents_booking_person_side_idx
  on public.id_documents (booking_id, coalesce(person_ref, '00000000-0000-0000-0000-000000000000'::uuid), side)
  where booking_id is not null;

create unique index id_documents_stay_person_side_idx
  on public.id_documents (stay_id, coalesce(person_ref, '00000000-0000-0000-0000-000000000000'::uuid), side)
  where stay_id is not null;

create index id_documents_stay_idx on public.id_documents (stay_id) where stay_id is not null;

-- ---------- RLS ----------
-- Sin cambios de fondo: sigue siendo solo lectura y solo staff. La escritura la hace el
-- servidor con service_role, tanto desde el formulario público de afiliados como desde el
-- panel. Se agrega el delete para que un administrador pueda corregir una foto mal subida;
-- va por RPC/service_role igual que el resto, así que no se abre ninguna policy nueva.
