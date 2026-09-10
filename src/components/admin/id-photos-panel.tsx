"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/admin/actions";
import type { IdDocument } from "@/lib/id-documents";

// "Subir fotos de carnet" — una fila por persona del registro (titular primero, después
// los acompañantes), con anverso y reverso. Sirve igual para una reserva (huéspedes o
// afiliados) y para una estadía de copropietario: lo único que cambia es el objetivo.

type FormAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;
const initial: ActionResult = { ok: false, error: null };

export type IdPhotoPerson = {
  // null = titular. Para un acompañante, el id de su fila.
  ref: string | null;
  name: string;
  documentId?: string | null;
};

export type IdPhotosTarget = { bookingId: string } | { stayId: string };

function targetFields(target: IdPhotosTarget) {
  return "bookingId" in target ? (
    <input type="hidden" name="bookingId" value={target.bookingId} />
  ) : (
    <input type="hidden" name="stayId" value={target.stayId} />
  );
}

function SubmitPhoto({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-deep px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-50"
      disabled={pending}
    >
      {pending ? "Subiendo…" : label}
    </button>
  );
}

function Feedback({ error, ok }: ActionResult) {
  return error ? (
    <p role="alert" className="mt-1 text-xs text-rose-700">
      {error}
    </p>
  ) : ok ? (
    <p role="status" className="mt-1 text-xs text-emerald-700">
      Foto guardada.
    </p>
  ) : null;
}

function PhotoSlot({
  target,
  person,
  side,
  doc,
  uploadAction,
  deleteAction,
  canDelete,
}: {
  target: IdPhotosTarget;
  person: IdPhotoPerson;
  side: "front" | "back";
  doc: IdDocument | undefined;
  uploadAction: FormAction;
  deleteAction: FormAction;
  canDelete: boolean;
}) {
  const [uploadState, upload] = useActionState(uploadAction, initial);
  const [deleteState, remove] = useActionState(deleteAction, initial);
  const label = side === "front" ? "Anverso" : "Reverso";

  return (
    <div className="rounded border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>

      {doc ? (
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-sm font-semibold text-cyan-700"
        >
          {doc.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc.url}
              alt={`Carnet de ${person.name}, ${label.toLowerCase()}`}
              className="h-36 w-full rounded object-cover"
            />
          ) : (
            <span className="block rounded bg-slate-50 py-8 text-center text-slate-500">
              Ver PDF
            </span>
          )}
        </a>
      ) : (
        <p className="mt-2 rounded border border-dashed border-slate-300 py-6 text-center text-xs text-slate-500">
          Sin cargar
        </p>
      )}

      <form action={upload} className="mt-2 grid gap-2">
        {targetFields(target)}
        <input type="hidden" name="personKind" value={person.ref ? "acompanante" : "titular"} />
        {person.ref ? <input type="hidden" name="personRef" value={person.ref} /> : null}
        <input type="hidden" name="personName" value={person.name} />
        <input type="hidden" name="side" value={side} />
        <input
          required
          name="photo"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          // En el celular abre directo la cámara, que es como se usa en el mostrador.
          capture="environment"
          className="block w-full text-xs"
        />
        <div className="flex items-center gap-2">
          <SubmitPhoto label={doc ? "Reemplazar" : "Subir"} />
          <Feedback {...uploadState} />
        </div>
      </form>

      {doc && canDelete ? (
        <form action={remove} className="mt-2">
          {targetFields(target)}
          <input type="hidden" name="documentId" value={doc.id} />
          <button className="text-xs font-semibold text-rose-700 underline">Borrar foto</button>
          <Feedback {...deleteState} />
        </form>
      ) : null}
    </div>
  );
}

export function IdPhotosPanel({
  target,
  people,
  documents,
  uploadAction,
  deleteAction,
  canDelete = false,
}: {
  target: IdPhotosTarget;
  people: IdPhotoPerson[];
  documents: IdDocument[];
  uploadAction: FormAction;
  deleteAction: FormAction;
  canDelete?: boolean;
}) {
  const find = (personRef: string | null, side: "front" | "back") =>
    documents.find((doc) => (doc.personRef ?? null) === personRef && doc.side === side);

  return (
    <div className="mt-3 grid gap-5">
      <p className="text-sm text-slate-600">
        Foto del carnet de cada persona, anverso y reverso. JPG, PNG o PDF de hasta 8 MB. Solo la ve
        el personal de RentaMar.
      </p>
      {people.map((person) => (
        <div key={person.ref ?? "titular"}>
          <p className="text-sm font-semibold">
            {person.name}
            <span className="ml-2 font-normal text-slate-500">
              {person.ref ? "Acompañante" : "Titular"}
              {person.documentId ? ` · CI ${person.documentId}` : ""}
            </span>
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(["front", "back"] as const).map((side) => (
              <PhotoSlot
                key={side}
                target={target}
                person={person}
                side={side}
                doc={find(person.ref, side)}
                uploadAction={uploadAction}
                deleteAction={deleteAction}
                canDelete={canDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
