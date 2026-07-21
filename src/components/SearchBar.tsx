"use client";

import { Search } from "lucide-react";
import { useId, useState } from "react";

export default function SearchBar() {
  const base = useId();
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="glass-strong rounded-3xl p-2.5 sm:p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-white/12">
        <Field label="Llegada" htmlFor={`${base}-in`}>
          <input
            id={`${base}-in`}
            type="date"
            className="w-full bg-transparent text-sm text-cream outline-none [color-scheme:dark]"
          />
        </Field>
        <Field label="Salida" htmlFor={`${base}-out`}>
          <input
            id={`${base}-out`}
            type="date"
            className="w-full bg-transparent text-sm text-cream outline-none [color-scheme:dark]"
          />
        </Field>
        <Field label="Huéspedes" htmlFor={`${base}-guests`}>
          <select
            id={`${base}-guests`}
            defaultValue="2"
            className="w-full bg-transparent text-sm text-cream outline-none [&>option]:text-night"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "huésped" : "huéspedes"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo" htmlFor={`${base}-type`}>
          <select
            id={`${base}-type`}
            defaultValue="todos"
            className="w-full bg-transparent text-sm text-cream outline-none [&>option]:text-night"
          >
            <option value="todos">Todos</option>
            <option value="departamento">Departamento</option>
            <option value="casa">Casa</option>
            <option value="suite">Suite</option>
            <option value="villa">Villa</option>
          </select>
        </Field>
      </div>

      <button
        type="submit"
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-turquoise px-6 py-3.5 text-sm font-semibold text-deep transition-colors hover:bg-turquoise-soft sm:mt-3"
      >
        <Search size={18} aria-hidden="true" />
        Buscar
      </button>

      <p aria-live="polite" className="sr-only">
        {submitted ? "Búsqueda de ejemplo enviada." : ""}
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
