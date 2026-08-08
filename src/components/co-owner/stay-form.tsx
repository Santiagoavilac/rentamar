"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { registerStayAction, type StayFormState } from "@/app/copropietarios/actions";
import { DeclarationButton } from "@/components/declaration-button";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-night";
const labelClass = "text-sm font-medium text-slate-700";

const MAX_GUESTS = 20;

type Guest = { fullName: string; documentId: string; phone: string; birthDate: string };

const emptyGuest: Guest = { fullName: "", documentId: "", phone: "", birthDate: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-deep px-4 py-3 font-semibold text-cream transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? "Registrando…" : "Registrar estadía"}
    </button>
  );
}

export default function StayForm({
  propertyName,
  roomCount,
}: {
  propertyName: string;
  roomCount: number;
}) {
  const [state, formAction] = useActionState<StayFormState, FormData>(registerStayAction, {
    ok: false,
    error: null,
    stayId: null,
  });
  const formRef = useRef<HTMLFormElement>(null);
  // Solo los huéspedes del 2 en adelante: el 1 es quien llena el formulario y firma.
  const [guests, setGuests] = useState<Guest[]>([]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setGuests([]);
    }
  }, [state.ok]);

  const updateGuest = (index: number, patch: Partial<Guest>) =>
    setGuests((current) => current.map((g, i) => (i === index ? { ...g, ...patch } : g)));

  return (
    <form ref={formRef} action={formAction} className="grid gap-6">
      <input type="hidden" name="guests" value={JSON.stringify(guests)} />

      {/* La propiedad viene con la cuenta: se muestra, no se elige ni se reescribe. */}
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <span className="font-semibold">{propertyName}</span> · {roomCount}{" "}
        {roomCount === 1 ? "habitación" : "habitaciones"}
      </div>

      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Huéspedes</h2>
          <button
            type="button"
            disabled={guests.length + 1 >= MAX_GUESTS}
            onClick={() => setGuests((current) => [...current, { ...emptyGuest }])}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            <Plus size={14} /> Agregar huésped
          </button>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-200 p-4">
          <span className="text-xs font-semibold text-slate-500">Huésped 1 (vos)</span>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Nombre completo
              <input required name="fullName" className={inputClass} />
            </label>
            <label className={labelClass}>
              CI
              <input required name="documentId" className={inputClass} />
            </label>
            <label className={labelClass}>
              Teléfono
              <input required name="phone" inputMode="tel" className={inputClass} />
            </label>
            <label className={labelClass}>
              Fecha de nacimiento
              <input required type="date" name="birthDate" className={inputClass} />
            </label>
            <label className={labelClass}>
              Nacionalidad
              <input required name="nationality" defaultValue="Boliviana" className={inputClass} />
            </label>
            <label className={labelClass}>
              Ciudad de residencia
              <input required name="city" className={inputClass} />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            La nacionalidad y la ciudad solo se piden a quien firma la declaración jurada.
          </p>
        </div>

        {guests.map((guest, index) => (
          <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Huésped {index + 2}</span>
              <button
                type="button"
                onClick={() => setGuests((c) => c.filter((_, i) => i !== index))}
                className="text-slate-400 hover:text-rose-700"
                aria-label={`Eliminar huésped ${index + 2}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Nombre completo
                <input
                  required
                  value={guest.fullName}
                  onChange={(e) => updateGuest(index, { fullName: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                CI
                <input
                  required
                  value={guest.documentId}
                  onChange={(e) => updateGuest(index, { documentId: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Teléfono
                <input
                  required
                  inputMode="tel"
                  value={guest.phone}
                  onChange={(e) => updateGuest(index, { phone: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Fecha de nacimiento
                <input
                  required
                  type="date"
                  value={guest.birthDate}
                  onChange={(e) => updateGuest(index, { birthDate: e.target.value })}
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Fecha de entrada
          <input required type="date" name="checkInDate" className={inputClass} />
        </label>
        <label className={labelClass}>
          Hora de entrada
          <input required type="time" name="checkInTime" className={inputClass} />
        </label>
        <label className={labelClass}>
          Fecha de salida
          <input required type="date" name="checkOutDate" className={inputClass} />
        </label>
        <label className={labelClass}>
          Hora de salida
          <input required type="time" name="checkOutTime" className={inputClass} />
        </label>
      </div>

      <label className={labelClass}>
        Menores de 2 años
        <input type="number" name="minors" min={0} max={50} defaultValue={0} className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          No se registran uno por uno: solo indicá cuántos son.
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Estadía registrada correctamente.
        </p>
      ) : null}

      <SubmitButton />

      {state.stayId ? <DeclarationButton target={{ kind: "stay", stayId: state.stayId }} /> : null}
    </form>
  );
}
