-- Carnets en lote.
--
-- En la oficina no van persona por persona: apilan todos los carnets en la mesa y sacan
-- una tanda de fotos de anverso y otra de reverso. Pedirles que elijan de quién es cada
-- foto antes de subirla era justamente lo que demoraba.
--
-- El modelo pasa a ser: las fotos son del REGISTRO, y la persona es opcional. Se suben
-- todas juntas sin asignar y, si alguna vez hace falta identificar una, se etiqueta después.

-- Sin asignar es ahora un estado válido de primera clase, no un hueco.
alter table public.id_documents drop constraint id_documents_person_ref_check;

alter table public.id_documents drop constraint id_documents_person_kind_check;

alter table public.id_documents
  add constraint id_documents_person_kind_check
  check (person_kind in ('titular', 'acompanante', 'sin_asignar'));

alter table public.id_documents
  add constraint id_documents_person_ref_check check (
    (person_kind = 'acompanante' and person_ref is not null)
    or (person_kind in ('titular', 'sin_asignar') and person_ref is null)
  );

alter table public.id_documents alter column person_kind set default 'sin_asignar';

-- Se cae la unicidad por persona y lado: una foto de la mesa puede tener varios carnets, y
-- una tanda trae varias fotos del mismo lado. Repetir ya no es un error, es el caso normal.
drop index if exists public.id_documents_booking_person_side_idx;
drop index if exists public.id_documents_stay_person_side_idx;

create index id_documents_booking_idx2 on public.id_documents (booking_id) where booking_id is not null;
