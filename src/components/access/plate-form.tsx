"use client";

import { useActionState, useEffect, useState } from "react";

// Único dato que el guardia puede escribir en /guardias: la placa del vehículo. Todo lo
// demás en esa pantalla es de solo lectura a propósito.

type PlateFormState = { ok: boolean; error: string | null };
type PlateAction = (state: PlateFormState, formData: FormData) => Promise<PlateFormState>;
const initial: PlateFormState = { ok: false, error: null };

export function PlateForm({
  action,
  target,
  currentPlate,
}: {
  action: PlateAction;
  target: { bookingId: string } | { stayId: string };
  currentPlate: string | null;
}) {
  const [state, formAction] = useActionState(action, initial);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2 text-xs font-semibold text-cyan-700 underline"
      >
        {currentPlate ? `Placa: ${currentPlate} · editar` : "Anotar placa"}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      {"bookingId" in target ? (
        <input type="hidden" name="bookingId" value={target.bookingId} />
      ) : (
        <input type="hidden" name="stayId" value={target.stayId} />
      )}
      <input
        name="plate"
        defaultValue={currentPlate ?? ""}
        placeholder="Placa"
        maxLength={20}
        autoFocus
        className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm uppercase"
      />
      <button className="rounded-lg bg-deep px-3 py-1.5 text-xs font-semibold text-cream">
        Guardar
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-slate-500 underline"
      >
        Cancelar
      </button>
      {state.error ? (
        <p role="alert" className="basis-full text-xs text-rose-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
