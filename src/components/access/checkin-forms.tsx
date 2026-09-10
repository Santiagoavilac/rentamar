"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/admin/actions";
import { ADMIN_TIME_ZONE } from "@/lib/admin/planner-query";

// Botón verde/rojo por huésped. Recepción marca a cada persona a medida que se presenta:
// un grupo aprobado puede llegar en tandas, y quien todavía no pasó no tiene manilla.

type FormAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;
const initial: ActionResult = { ok: false, error: null };

// Siempre en hora de Bolivia, igual que el resto del panel. Se formatea acá y no en el
// servidor porque las funciones no cruzan la frontera server→cliente.
function formatCheckinTime(value: string): string {
  return new Date(value).toLocaleString("es-BO", {
    timeZone: ADMIN_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export type CheckinTarget = { bookingId: string } | { stayId: string };

export type CheckinPerson = {
  /** null = titular. Para un acompañante, el id de su fila. */
  ref: string | null;
  name: string;
  documentId?: string | null;
  checkedIn: boolean;
  wristbandDelivered: boolean;
  checkedInAt?: string | null;
};

function TargetFields({ target }: { target: CheckinTarget }) {
  return "bookingId" in target ? (
    <input type="hidden" name="bookingId" value={target.bookingId} />
  ) : (
    <input type="hidden" name="stayId" value={target.stayId} />
  );
}

function ActionButton({ label, tone }: { label: string; tone: "green" | "plain" }) {
  const { pending } = useFormStatus();
  const styles =
    tone === "green" ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700";
  return (
    <button
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${styles}`}
      disabled={pending}
    >
      {pending ? "Guardando…" : label}
    </button>
  );
}

function Feedback({ error }: ActionResult) {
  return error ? (
    <p role="alert" className="mt-1 text-xs text-rose-700">
      {error}
    </p>
  ) : null;
}

function PersonRow({
  target,
  person,
  checkInAction,
  undoAction,
}: {
  target: CheckinTarget;
  person: CheckinPerson;
  checkInAction: FormAction;
  undoAction: FormAction;
}) {
  const [checkInState, checkIn] = useActionState(checkInAction, initial);
  const [undoState, undo] = useActionState(undoAction, initial);

  return (
    <li className="rounded border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong className="text-sm">{person.name}</strong>
          <span className="block text-xs text-slate-500">
            {person.ref ? "Acompañante" : "Titular"}
            {person.documentId ? ` · CI ${person.documentId}` : ""}
          </span>
          {person.checkedIn ? (
            <span className="mt-1 block text-xs text-emerald-700">
              Registrado{person.checkedInAt ? ` el ${formatCheckinTime(person.checkedInAt)}` : ""}
              {person.wristbandDelivered ? " · manilla entregada" : " · sin manilla"}
            </span>
          ) : (
            <span className="mt-1 block text-xs text-rose-700">Todavía no se presentó</span>
          )}
        </div>

        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            person.checkedIn ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          }`}
        >
          {person.checkedIn ? "Adentro" : "Sin registrar"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <form action={checkIn} className="flex flex-wrap items-center gap-3">
          <TargetFields target={target} />
          <input type="hidden" name="personKind" value={person.ref ? "acompanante" : "titular"} />
          {person.ref ? <input type="hidden" name="personRef" value={person.ref} /> : null}
          <input type="hidden" name="personName" value={person.name} />
          <input type="hidden" name="personDocumentId" value={person.documentId ?? ""} />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              name="wristbandDelivered"
              defaultChecked={person.wristbandDelivered}
            />
            Entregué la manilla
          </label>
          <ActionButton
            label={person.checkedIn ? "Actualizar" : "Registrar ingreso"}
            tone={person.checkedIn ? "plain" : "green"}
          />
        </form>

        {person.checkedIn ? (
          <form action={undo}>
            <TargetFields target={target} />
            {person.ref ? <input type="hidden" name="personRef" value={person.ref} /> : null}
            <button className="text-xs font-semibold text-rose-700 underline">
              Deshacer registro
            </button>
          </form>
        ) : null}
      </div>
      <Feedback {...checkInState} />
      <Feedback {...undoState} />
    </li>
  );
}

export function CheckinPanel({
  target,
  people,
  approved,
  checkInAction,
  undoAction,
}: {
  target: CheckinTarget;
  people: CheckinPerson[];
  approved: boolean;
  checkInAction: FormAction;
  undoAction: FormAction;
}) {
  return (
    <div className="mt-3 grid gap-3">
      {approved ? (
        <p className="text-sm text-slate-600">
          Marcá a cada persona cuando se presente en el mostrador. La hora del primer registro es la
          que aparece en Ingresos.
        </p>
      ) : (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Este grupo todavía no tiene el ingreso aprobado en Control de acceso. Primero la
          declaración jurada, la garantía y las manillas; recién después se registra la entrada.
        </p>
      )}
      <ul className="grid gap-2">
        {people.map((person) => (
          <PersonRow
            key={person.ref ?? "titular"}
            target={target}
            person={person}
            checkInAction={checkInAction}
            undoAction={undoAction}
          />
        ))}
      </ul>
    </div>
  );
}
