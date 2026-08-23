"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

export type SearchDefaults = {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  type?: string;
};

export default function SearchBar({
  types = [],
  defaults,
}: {
  types?: string[];
  defaults?: SearchDefaults;
}) {
  const base = useId();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? "");
  const [guests, setGuests] = useState(String(defaults?.guests ?? 2));
  const [type, setType] = useState(defaults?.type ?? "todos");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Las fechas son opcionales, pero si hay una tiene que estar la otra.
    if (Boolean(checkIn) !== Boolean(checkOut)) {
      setError("Completá la fecha de llegada y la de salida.");
      return;
    }
    if (checkIn && checkOut && checkOut <= checkIn) {
      setError("La salida debe ser posterior a la llegada.");
      return;
    }
    setError("");

    const params = new URLSearchParams();
    if (checkIn && checkOut) {
      params.set("checkIn", checkIn);
      params.set("checkOut", checkOut);
    }
    params.set("guests", guests);
    if (type !== "todos") params.set("type", type);

    router.push(`/propiedades?${params.toString()}`);
  }

  return (
    <form className="glass-strong rounded-3xl p-2.5 sm:p-3" onSubmit={handleSubmit}>
      <div
        className={`grid grid-cols-2 gap-2 sm:gap-0 sm:divide-x sm:divide-white/12 ${
          types.length ? "sm:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        <Field label="Llegada" htmlFor={`${base}-in`}>
          <input
            id={`${base}-in`}
            type="date"
            min={today}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full bg-transparent text-sm text-cream outline-none [color-scheme:dark]"
          />
        </Field>
        <Field label="Salida" htmlFor={`${base}-out`}>
          <input
            id={`${base}-out`}
            type="date"
            min={checkIn || today}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full bg-transparent text-sm text-cream outline-none [color-scheme:dark]"
          />
        </Field>
        <Field label="Huéspedes" htmlFor={`${base}-guests`}>
          <select
            id={`${base}-guests`}
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className="w-full bg-transparent text-sm text-cream outline-none [&>option]:text-night"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "huésped" : "huéspedes"}
              </option>
            ))}
          </select>
        </Field>
        {/* El tipo solo aparece si hay propiedades cargadas con tipo: sin opciones muertas. */}
        {types.length ? (
          <Field label="Tipo" htmlFor={`${base}-type`}>
            <select
              id={`${base}-type`}
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-transparent text-sm text-cream outline-none [&>option]:text-night"
            >
              <option value="todos">Todos</option>
              {types.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <button
        type="submit"
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-turquoise px-6 py-3.5 text-sm font-semibold text-deep transition-colors hover:bg-turquoise-soft sm:mt-3"
      >
        <Search size={18} aria-hidden="true" />
        Buscar
      </button>

      <p aria-live="polite" className={error ? "mt-2 px-1 text-sm text-cream" : "sr-only"}>
        {error}
      </p>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2.5 sm:px-4">
      <label htmlFor={htmlFor} className="eyebrow text-[0.6rem] text-cream/55">
        {label}
      </label>
      {children}
    </div>
  );
}
