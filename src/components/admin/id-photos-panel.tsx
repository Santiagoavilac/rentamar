"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/admin/actions";
import type { IdDocument } from "@/lib/id-documents";

// "Subir fotos de carnet". En el mostrador apilan todos los carnets en la mesa y sacan una
// tanda de anversos y otra de reversos: por eso se sube en lote y sin decir de quién es cada
// foto. Asignarla a una persona es opcional y se hace después, si alguna vez hace falta.

type FormAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;
const initial: ActionResult = { ok: false, error: null };

export type IdPhotoPerson = {
  /** null = titular. Para un acompañante, el id de su fila. */
  ref: string | null;
  name: string;
  documentId?: string | null;
};

export type IdPhotosTarget = { bookingId: string } | { stayId: string };

function TargetFields({ target }: { target: IdPhotosTarget }) {
  return "bookingId" in target ? (
    <input type="hidden" name="bookingId" value={target.bookingId} />
  ) : (
    <input type="hidden" name="stayId" value={target.stayId} />
  );
}

function Submit({ label, count }: { label: string; count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-deep px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50"
      disabled={pending || count === 0}
    >
      {pending ? "Subiendo…" : count > 0 ? `${label} (${count})` : label}
    </button>
  );
}

function Feedback({ error, ok }: ActionResult) {
  // Un lote parcial vuelve con ok y un texto: es aviso, no error.
  if (ok && error) {
    return (
      <p role="status" className="mt-2 text-sm text-amber-700">
        {error}
      </p>
    );
  }
  return error ? (
    <p role="alert" className="mt-2 text-sm text-rose-700">
      {error}
    </p>
  ) : ok ? (
    <p role="status" className="mt-2 text-sm text-emerald-700">
      Fotos guardadas.
    </p>
  ) : null;
}

function BatchUploader({
  target,
  people,
  action,
}: {
  target: IdPhotosTarget;
  people: IdPhotoPerson[];
  action: FormAction;
}) {
  const [state, formAction] = useActionState(action, initial);
  const [count, setCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  // "" = sin asignar, "titular", o el id del acompañante.
  const [persona, setPersona] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Soltar archivos sobre la caja equivale a elegirlos: se los mete en el mismo input para
  // que el formulario los mande igual, sin una segunda ruta de subida.
  function drop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!inputRef.current || !event.dataTransfer.files.length) return;
    inputRef.current.files = event.dataTransfer.files;
    setCount(event.dataTransfer.files.length);
  }

  return (
    <form action={formAction} className="grid gap-3">
      <TargetFields target={target} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Lado
          <select
            name="side"
            defaultValue="front"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-normal"
          >
            <option value="front">Anverso</option>
            <option value="back">Reverso</option>
          </select>
        </label>

        <label className="text-sm font-semibold">
          Persona (opcional)
          <select
            name="person"
            value={persona}
            onChange={(event) => setPersona(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-normal"
          >
            <option value="">Sin asignar</option>
            {people.map((person) => (
              <option key={person.ref ?? "titular"} value={person.ref ?? "titular"}>
                {person.name}
                {person.ref ? "" : " (titular)"}
              </option>
            ))}
          </select>
          {/* El nombre viaja congelado para que la foto siga siendo identificable si
              después se corrige o se borra al acompañante. */}
          <input
            type="hidden"
            name="personName"
            value={people.find((p) => (p.ref ?? "titular") === persona)?.name ?? ""}
          />
        </label>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors ${
          dragging ? "border-cyan-600 bg-cyan-50 text-cyan-800" : "border-slate-300 text-slate-600"
        }`}
      >
        <strong className="block">Arrastrá las fotos acá</strong>
        <span className="mt-1 block text-xs">
          O hacé clic para elegirlas. Podés seleccionar varias de una vez.
        </span>
        <input
          ref={inputRef}
          required
          multiple
          name="photo"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          capture="environment"
          onChange={(event) => setCount(event.target.files?.length ?? 0)}
          className="sr-only"
        />
        {count > 0 ? (
          <span className="mt-2 block text-xs font-semibold text-cyan-800">
            {count} {count === 1 ? "foto lista" : "fotos listas"} para subir
          </span>
        ) : null}
      </div>

      <div>
        <Submit label="Subir fotos" count={count} />
        <Feedback {...state} />
      </div>
    </form>
  );
}

function PhotoCard({
  doc,
  target,
  deleteAction,
  canDelete,
}: {
  doc: IdDocument;
  target: IdPhotosTarget;
  deleteAction: FormAction;
  canDelete: boolean;
}) {
  const [state, remove] = useActionState(deleteAction, initial);
  const lado = doc.side === "front" ? "Anverso" : "Reverso";
  const quien = doc.personKind === "sin_asignar" ? "Sin asignar" : doc.personName || "Titular";

  return (
    <li className="rounded border border-slate-200 p-2">
      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block">
        {doc.mimeType.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.url}
            alt={`Carnet, ${lado.toLowerCase()}`}
            className="h-32 w-full rounded object-cover"
          />
        ) : (
          <span className="block rounded bg-slate-50 py-10 text-center text-sm font-semibold text-cyan-700">
            Ver PDF
          </span>
        )}
      </a>
      <p className="mt-1.5 text-xs font-semibold">{lado}</p>
      <p className="text-xs text-slate-500">{quien}</p>
      {canDelete ? (
        <form action={remove} className="mt-1">
          <TargetFields target={target} />
          <input type="hidden" name="documentId" value={doc.id} />
          <button className="text-xs font-semibold text-rose-700 underline">Borrar</button>
          <Feedback {...state} />
        </form>
      ) : null}
    </li>
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
  // Anversos primero, después reversos: es el orden en que se sacan las tandas.
  const ordenadas = [...documents].sort((a, b) =>
    a.side === b.side ? 0 : a.side === "front" ? -1 : 1,
  );

  return (
    <div className="mt-3 grid gap-5">
      <BatchUploader target={target} people={people} action={uploadAction} />

      <div>
        <p className="text-sm font-semibold">
          Fotos cargadas ({documents.length})
          <span className="ml-2 font-normal text-slate-500">
            JPG, PNG o PDF de hasta 8 MB. Solo las ve el personal de RentaMar.
          </span>
        </p>
        {ordenadas.length ? (
          <ul className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {ordenadas.map((doc) => (
              <PhotoCard
                key={doc.id}
                doc={doc}
                target={target}
                deleteAction={deleteAction}
                canDelete={canDelete}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Todavía no hay fotos de carnet en este registro.
          </p>
        )}
      </div>
    </div>
  );
}
