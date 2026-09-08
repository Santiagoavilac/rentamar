"use client";

import { useActionState, useState } from "react";
import { Submit } from "@/components/admin/forms";
import type { ActionResult } from "@/lib/admin/actions";
import type { AccessEntry } from "@/lib/access";

type FormAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;
const initial: ActionResult = { ok: false, error: null };

// Formularios del control de acceso. Espejo de account-forms.tsx: un useActionState por
// formulario y el mismo par de banners role="alert" / role="status".

function Feedback({ state, okLabel }: { state: ActionResult; okLabel: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-rose-700">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-emerald-700">
        {okLabel}
      </p>
    );
  }
  return null;
}

// El par reserva/estadía es excluyente: se manda el que corresponda y el otro no viaja.
function TargetFields({ entry }: { entry: AccessEntry }) {
  return entry.isBooking ? (
    <input type="hidden" name="bookingId" value={entry.entryId} />
  ) : (
    <input type="hidden" name="stayId" value={entry.entryId} />
  );
}

const CHECKS = [
  ["declarationSigned", "Firmó la declaración jurada"],
  ["depositReceived", "Dejó la garantía"],
  ["wristbandsDelivered", "Retiró sus manillas"],
] as const;

// Aprobar exige marcar las tres casillas: es la constancia de que la persona pasó por la
// oficina. El botón queda deshabilitado hasta que estén las tres.
export function ApproveAccessForm({ action, entry }: { action: FormAction; entry: AccessEntry }) {
  const [state, formAction] = useActionState(action, initial);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = CHECKS.every(([name]) => checked[name]);

  return (
    <form action={formAction} className="grid gap-2">
      <TargetFields entry={entry} />
      {CHECKS.map(([name, label]) => (
        <label key={name} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            checked={Boolean(checked[name])}
            onChange={(event) =>
              setChecked((previous) => ({ ...previous, [name]: event.target.checked }))
            }
            className="h-4 w-4"
          />
          {label}
        </label>
      ))}
      <label className="text-sm">
        Observaciones (opcional)
        <input name="notes" maxLength={500} className="mt-1 w-full rounded border p-2" />
      </label>
      <div>
        <Submit label="Aprobar ingreso" disabled={!allChecked} />
      </div>
      {allChecked ? null : (
        <p className="text-xs text-slate-500">
          Marcá las tres casillas para poder aprobar. Hasta entonces el guardia lo ve en rojo.
        </p>
      )}
      <Feedback state={state} okLabel="Ingreso aprobado." />
    </form>
  );
}

export function RevokeAccessForm({ action, entry }: { action: FormAction; entry: AccessEntry }) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-2">
      <TargetFields entry={entry} />
      <div>
        <Submit label="Quitar aprobación" />
      </div>
      <Feedback state={state} okLabel="Aprobación retirada." />
    </form>
  );
}

// Los alquileres del canal directo no piden los nombres del resto del grupo: se cargan acá,
// cuando pasan por la oficina, para que el guardia vea a quién puede dejar entrar.
export function AccessCompanionsForm({
  action,
  entry,
}: {
  action: FormAction;
  entry: AccessEntry;
}) {
  const [state, formAction] = useActionState(action, initial);
  // Una fila por acompañante declarado, más las que falten para completar el grupo.
  const missing = Math.max(0, entry.guestCount - 1 - entry.people.length);
  const [rows, setRows] = useState(Math.max(1, entry.people.length + missing));

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="bookingId" value={entry.entryId} />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex flex-wrap gap-2">
          <input
            name="companionName"
            defaultValue={entry.people[index]?.nombre ?? ""}
            placeholder="Nombre completo"
            maxLength={160}
            className="min-w-0 flex-1 rounded border p-2 text-sm"
          />
          <input
            name="companionDocument"
            defaultValue={entry.people[index]?.carnet ?? ""}
            placeholder="Carnet"
            maxLength={40}
            className="w-32 rounded border p-2 text-sm"
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRows((previous) => Math.min(20, previous + 1))}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          Agregar otro
        </button>
        <Submit label="Guardar acompañantes" />
      </div>
      <p className="text-xs text-slate-500">
        Se guarda la lista completa: las filas vacías se descartan y las que borres dejan de
        figurar.
      </p>
      <Feedback state={state} okLabel="Acompañantes guardados." />
    </form>
  );
}
