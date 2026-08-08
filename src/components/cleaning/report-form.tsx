"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { registerCleaningAction, type CleaningFormState } from "@/app/limpieza/actions";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-night";
const labelClass = "text-sm font-medium text-slate-700";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-deep px-4 py-3 font-semibold text-cream transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? "Registrando…" : "Registrar limpieza"}
    </button>
  );
}

export default function CleaningReportForm({
  properties,
  today,
}: {
  properties: { id: string; name: string }[];
  today: string;
}) {
  const [state, formAction] = useActionState<CleaningFormState, FormData>(registerCleaningAction, {
    ok: false,
    error: null,
  });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <label className={labelClass}>
        Departamento
        <select required name="propertyId" defaultValue="" className={inputClass}>
          <option value="" disabled>
            Elegí el departamento
          </option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Fecha
        <input required type="date" name="workDate" defaultValue={today} className={inputClass} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Hora de entrada
          <input required type="time" name="entryTime" className={inputClass} />
        </label>
        <label className={labelClass}>
          Hora de salida
          <input required type="time" name="exitTime" className={inputClass} />
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Limpieza registrada.
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
